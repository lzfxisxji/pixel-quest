import subprocess,json,base64
from pathlib import Path
repo='repos/lzfxisxji/pixel-quest'
def api(path,payload=None):
 args=['gh','api',path]
 if payload is not None:args+=['--method','POST','--input','-']
 r=subprocess.run(args,input=json.dumps(payload) if payload is not None else None,capture_output=True,text=True,encoding='utf-8')
 if r.returncode:raise RuntimeError(r.stderr)
 return json.loads(r.stdout)
head=api(repo+'/git/ref/heads/main')['object']['sha'];base=api(repo+'/git/commits/'+head)['tree']['sha']
files=['touch-joystick.js','touch-joystick.css','index.html','badminton.html','fighting.html','tank.html','bomber.html','frost.html','island.html'];entries=[]
for name in files:
 content=Path(name).read_bytes()
 blob=api(repo+'/git/blobs',{'content':base64.b64encode(content).decode(),'encoding':'base64'})
 entries.append({'path':name,'mode':'100644','type':'blob','sha':blob['sha']})
tree=api(repo+'/git/trees',{'base_tree':base,'tree':entries})
commit=api(repo+'/git/commits',{'message':'Overlay touch joystick and ergonomic action clusters on full gameplay viewport','tree':tree['sha'],'parents':[head]})
if api(repo+'/git/ref/heads/main')['object']['sha']!=head:raise RuntimeError('Remote branch changed; no ref update performed')
r=subprocess.run(['gh','api',repo+'/git/refs/heads/main','--method','PATCH','--input','-'],input=json.dumps({'sha':commit['sha'],'force':False}),capture_output=True,text=True,encoding='utf-8')
if r.returncode:raise RuntimeError(r.stderr)
print('Published scoped joystick repair:',commit['sha']);print('Files:',', '.join(files))
