import { CozeAPI, ChatEventType, ChatStatus, COZE_CN_BASE_URL, RoleType } from '@coze/api';
 

const DEFAULT_BREAK_POINTS = [
    '。', // 句号
    '，', // 逗号
    '！', // 感叹号
    '？', // 问号
    '.', // 英文句号
    ',', // 英文逗号
    '；', // 分号
    ';', // 英文分号
    '：', // 冒号
    ':', // 英文冒号
    '…', // 省略号
    '—', // 破折号
];

export async function test(question, botId){
    const client = new CozeAPI({
        baseURL: COZE_CN_BASE_URL,
        token: process.env.COZE_PERSON_TOKEN,
    });
    const bot_id = botId ?? process.env.COZE_BOT_ID ;

    const additional_messages = [
        {
            type: RoleType.User,
            content_type: 'text',
            content: question
        }
    ];
    console.log('additional_messages',additional_messages)
    const stream = await client.chat.stream({
        bot_id,
        additional_messages
    });
     for await (const part of stream) {
         if (part.event === ChatEventType.CONVERSATION_MESSAGE_DELTA) {
             console.log(part.data.content); // Real-time response
         }else{
            console.log(part);
        }
     }
}

async function* invoke(question, botId) {
    const client = new CozeAPI({
        baseURL: COZE_CN_BASE_URL,
        token: process.env.COZE_PERSON_TOKEN,
    });
    const bot_id = botId ?? process.env.COZE_BOT_ID ;

    const stream = await client.chat.stream({
        bot_id,
        additional_messages: [
            {
                role: RoleType.User,
                content: question,
                content_type: 'text',
            }
        ]
    });

    // for await (const part of stream) {
    //     if (part.event === ChatEventType.CONVERSATION_MESSAGE_DELTA) {
    //         console.log(part.data.content); // Real-time response
    //     }
    // }

    let totalLength = 0;
    let buffer = '';
    let content = '';

    for await (const part of stream) {
        if (part.event === ChatEventType.CONVERSATION_MESSAGE_DELTA) {
            const chunk = part.data.content;
            content += chunk;
            
            buffer += chunk;

            const lastDelimiterIndex = DEFAULT_BREAK_POINTS.reduce((lastIndex, delimiter) => {
                const index = buffer.lastIndexOf(delimiter);
                return index > lastIndex ? index : lastIndex;
            }, -1);

            if (lastDelimiterIndex !== -1 && totalLength < 15) {
                totalLength += lastDelimiterIndex + 1;
                yield buffer.slice(0, lastDelimiterIndex + 1);
                buffer = buffer.slice(lastDelimiterIndex + 1);
            }
        }else{
        }

    }
    // 如果还有内容要释放
    if (buffer.length>0) {
        yield buffer;
    }
}

export { invoke }