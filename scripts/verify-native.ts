import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import product from '../native/product.json'
const root=process.cwd()
const pin=JSON.parse(readFileSync('native/hq-source.json','utf8'))
const {mountNativeScreen}=await import(import.meta.resolve('@stacksjs/stx/native/testing', pathToFileURL(join(root,'storage/native/hq',pin.revision,'package.json')).href))
const directory=join(root,'storage/framework/mobile/ios/native-screens')
const read=(path:string)=>{const b=readFileSync(path);return (b[0]===0x1f&&b[1]===0x8b?gunzipSync(b):b).toString()}
const messages:Record<string,string>={}
for(const lang of readdirSync(join(directory,'__messages'))){if(lang.includes('.'))continue;for(const file of readdirSync(join(directory,'__messages',lang)))if(file.endsWith('.json'))messages[`${lang}/${file.slice(0,-5)}`]=read(join(directory,'__messages',lang,file))}
const code=`globalThis.__stxNativeReadMessages=function(language,area){return (${JSON.stringify(messages)})[language+'/'+area]||null};\n${read(join(directory,'__runtime.js'))}\n${read(join(directory,'views-login.js'))}`
const phone=mountNativeScreen(code,'views-login',{platform:'ios',colorScheme:'dark',appURL:`${product.site}/m`,apiBase:`${product.site}/api`,sessionTokenKey:'auth.token',api:(path:string)=>path.includes('social/providers')?{providers:[]}:undefined})
try {
 await phone.settle(200)
 const nodes=[...phone.nodes.values()]
 const button=nodes.find((n:any)=>n.props.testID==='login-submit')
 const text=phone.texts()
 const wordmark=`data:image/png;base64,${readFileSync(join(root,'native',product.assets.wordmark)).toString('base64')}`
 const logos=nodes.filter((n:any)=>n.props.source === wordmark)
 const report={text,button:button?.style,logos:logos.map((n:any)=>({type:n.type,embeddedBytes:Buffer.from(n.props.source.split(',')[1], 'base64').length})),input:nodes.find((n:any)=>n.props.testID==='login-email')?.style,route:'views-login',source:pin.revision}
 writeFileSync('storage/native/bundled-login-report.json',JSON.stringify(report,null,2))
 if(!button||button.style.backgroundColor!=='#dd0f15')throw new Error('The shipped sign-in action does not use LSU red')
 if(!logos.length)throw new Error('The shipped sign-in screen has no offline LSU wordmark')
 if(text.some((value:string)=>/HQ\.training/.test(value)))throw new Error('The shipped sign-in screen still names HQ.training')
 process.stdout.write(JSON.stringify(report,null,2)+'\n')
}
finally {phone.unmount()}
