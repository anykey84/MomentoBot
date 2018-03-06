const Telegraf = require('telegraf')
const session = require('telegraf/session')
const si = require('systeminformation')
const sql = require('mssql');
const sqlpool = require('./mssql');
const config = require('./config.json')

const users = [88696473, //я
    308375036, // Рома
    328099393, // Дима Лейфер
    264134030 //Слава
];

const authMiddleware = (ctx, next) => {
    const id = (ctx.chat.id);
    if (users.includes(id)) {
        next()
    } else {
        return ctx.reply('Доступ ограничен')
    }
}

const bot = new Telegraf(config.token);
sqlpool.connect();

bot.use(session())

bot.use((ctx, next) => {
    const start = new Date()
    return next().then(() => {
        const ms = new Date() - start
        console.log(`${ctx.chat.username} ${ctx.message.text} |`, 'response time %sms', ms)
    })
})

const commands = '/start: начало работы\n' +
    '/help: список команд\n' +
    '/info: информация о нагрузке системы\n' +
    '/pbp [phone number]: Получение ФИО и Id клиента по номеру телефона (GetPersonByPhone_OnlyPersonal)\n' +
    '/getphones [Id Person]: Получение личных телефонов по Id клиента (GetPersonPhones)\n' +
    '/id: ваш Telegram Chat Id';


bot.command('start', (ctx) => {
    return ctx.reply('Привет, человек!\n' +
        'Чего изволишь?\n\n' +
        'Команды:\n' + commands)
})

bot.command('help', (ctx) => {
    return ctx.reply(commands)
});

bot.command('id', (ctx) => {
    return ctx.reply(ctx.chat.id)
});

bot.command('/pbp', authMiddleware, (ctx) => {
    const phone = ctx.message.text.split(' ')[1];
    let p = parseInt(phone);
    if (p && p >= 80000000000 && p < 90000000000) {
        sqlpool.request()
            .input('phone', sql.VarChar(16), p.toString())
            .input('idUser', sql.UniqueIdentifier, config.userUID)
            .execute('GetPersonByPhone_OnlyPersonal', function (err, result) {  //запускаем
                if (err) {
                    console.log(err)
                    ctx.reply('Ошибка')
                }
                // console.log('--- result',result)
                if (result && result.recordset && result.recordset[0]) {
                    const res = (result.recordset[0]);
                    ctx.reply(`[${res.Id_Person}] ${res.FullName}`)
                } else {
                    ctx.reply('Телефон не найден')
                }
            })
    } else {
        ctx.reply('Неверный номер телефона. Номер должен вводиться в формате 8xxxxxxxxxx')
    }
})

bot.command('/getphones', authMiddleware, (ctx) => {
    const id = ctx.message.text.split(' ')[1];
    let p = parseInt(id);
    if (p) {
        sqlpool.request()
            .input('idPerson', sql.VarChar(16), p.toString())
            .input('idUser', sql.UniqueIdentifier, config.userUID)
            .input('isDeleted', sql.Bit, false)
            .execute('GetPersonPhones', function (err, result) {  //запускаем
                // console.log(result)
                if (err) {
                    console.log(err)
                    ctx.reply('Ошибка')
                }
                // console.log('--- result',result)
                let resultString = '';
                if (result && result.recordset.length > 0) {
                    const res = (result.recordset);
                    res.map(phone => {
                        resultString += `${phone.Phone}\n`
                    })
                    // ctx.reply(`[${res.Id_Person}] ${res.FullName}`)
                } else {
                    ctx.reply('Клиент не найден')
                }
                ctx.reply(resultString)
            })
    } else {
        ctx.reply('Неверный Id Person')
    }
})

bot.command('info', authMiddleware, (ctx) => {
    const id = (ctx.chat.id);
    if (users.includes(id)) {
        si.currentLoad((data) => {
            // console.log(data);
            si.mem((data2) => {
                const msg = `Текущая нагрузка CPU: ${Math.round(data.currentload)} %\n` +
                    `Средняя нагрузка CPU: ${Math.round(data.avgload)} %\n` +
                    `Используемый объем памяти: ${Math.round((data2.active / 1024 / 1024 / 1024) * 100) / 100}` +
                    ` из ${Math.round((data2.total / 1024 / 1024 / 1024) * 100) / 100} Гб`;
                return ctx.reply(msg)
            })
        });
    } else {
        return ctx.reply('Доступ ограничен')
    }

})


bot.startPolling()