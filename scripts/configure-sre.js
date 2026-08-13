const fs=require('fs'),path=require('path'),readline=require('readline');
const root=path.join(__dirname,'..'),dir=path.join(root,'config'),file=path.join(dir,'sre.local.json');
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
rl.question('Pega tu token privado SRE: ',token=>{token=token.trim();if(!token){console.error('Token vacío. No se realizaron cambios.');rl.close();process.exitCode=1;return;}fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(file,JSON.stringify({token,url:'https://sre.cl/api/company_info'},null,2),{mode:0o600});console.log('Token SRE guardado correctamente en config/sre.local.json');rl.close();});
