
import dotenv from 'dotenv'


import { invoke,test } from "./modules/coze.mjs";
dotenv.config();



async function main(){
    const result = invoke("你好啊，你是谁")
    for await(const res of result){
        console.log(res)
    }
}
main()