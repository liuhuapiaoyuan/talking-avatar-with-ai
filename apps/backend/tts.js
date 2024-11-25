
import dotenv from 'dotenv'
dotenv.config();
import {convertTextToSpeech} from './modules/huoshan.mjs'



convertTextToSpeech({
    text:"你好，我真的没有办法交代给你这件事情"
}).then(r=>{
  
})