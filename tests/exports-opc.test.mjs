import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildAuditXlsx,buildAuditPptx } from '../src/integrated-export.js';

const sample=[{id:'1',code:'REQ00001',description:'Requisito de prueba',eligibility:'INCREMENTAL',estimate_status:'Estimado',estimate_id:'7',wbs_count:'1',optimistic:'1',most_likely:'2',pert_expected:'2',pessimistic:'3',v08_agent:'V08-09',sdo_links:[],gap_links:[]}];
const py=`import sys,io,zipfile,xml.etree.ElementTree as ET,os,posixpath
raw=bytes.fromhex(sys.stdin.read().strip())
z=zipfile.ZipFile(io.BytesIO(raw))
assert z.testzip() is None
files=set(z.namelist())
assert '[Content_Types].xml' in files
assert '_rels/.rels' in files
for name in files:
  if name.endswith('.xml') or name.endswith('.rels'):
    root=ET.fromstring(z.read(name))
    if name.endswith('.rels'):
      for rel in root:
        target=rel.attrib.get('Target','')
        if rel.attrib.get('TargetMode')=='External': continue
        if name=='_rels/.rels': owner=''
        else:
          owner=name.replace('/_rels/','/')
          owner=owner[:owner.rfind('.rels')]
        resolved=posixpath.normpath(posixpath.join(posixpath.dirname(owner),target.lstrip('/')))
        assert resolved in files,(name,target,resolved)
if 'xl/workbook.xml' in files:
  assert 'xl/worksheets/sheet1.xml' in files
  assert b'REQ00001' in z.read('xl/worksheets/sheet1.xml')
if 'ppt/presentation.xml' in files:
  assert all('ppt/slides/slide'+str(i)+'.xml' in files for i in range(1,13))
  ET.fromstring(z.read('ppt/slides/slide12.xml'))
print('OOXML OK',len(files),'entries')
`;
for(const [label,bytes] of [['XLSX',buildAuditXlsx(sample)],['PPTX',buildAuditPptx({r48:{registryStatus:'not_registered'},overlaps:[]},sample)]]){
 test(label+' ZIP íntegro, XML válido y relaciones de partes existentes',()=>{
  const result=spawnSync('python3',['-c',py],{input:Buffer.from(bytes).toString('hex'),encoding:'utf8',maxBuffer:1024*1024});
  assert.equal(result.status,0,result.stderr||result.stdout);
 });
}
