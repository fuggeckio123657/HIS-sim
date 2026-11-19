import re,os
d=os.path.dirname(os.path.abspath(__file__))
rd=lambda f:open(os.path.join(d,'src',f),encoding='utf8').read()
html=rd('index.html').replace('<!--STYLE-->','<style>\n'+rd('style.css')+'\n</style>')
js=''.join('/* ==== %s ==== */\n%s\n'%(f,rd(f)) for f in ['core.js','seed.js','clinic-data.js','clinic-tpl.js','clinic-core.js','clinic-seed.js','remote.js','ui-core.js','ui-doctor.js','ui-dept.js','ui-clinic.js','ui-clinic2.js','ui-clinic3.js'])
boot="\nwindow.addEventListener('DOMContentLoaded',function(){HIS.UI.initLogin();document.getElementById('lg-ver').textContent=HIS.VERSION;});\n"
html=html.replace('<!--SCRIPTS-->','<script>\n'+js+boot+'</script>')
open(os.path.join(d,'his.html'),'w',encoding='utf8').write(html)
print('built his.html',len(html)//1024,'KB')
