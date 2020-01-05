const fs = require('fs');

function readFile(filename) {
    let file = fs.readFileSync(filename);
    return JSON.parse(file);
}

const config = readFile('config.json');

const request = require('request');
const iconv = require('iconv-lite');
const cheerio = require('cheerio');

let isEnd = false;

const time_table = [];
for(let i=0; i<7; i++) {
    time_table[i] = {};
    for (let j=1; j<=9; j++) {
        time_table[i][j] = [];
    }
    for(let j=0; j<6; j++) {
        time_table[i][String.fromCharCode(65+j)] = [];
    }
}

let courses = [];

const takeClassPrePage = async function (page, need, doSomething = () => {}, type) {
    return new Promise((resolve, reject) => {
        let url = "http://selcrs.nsysu.edu.tw/menu1/dplycourse.asp";
        let params = {
            a: 1,
            D0: 1082,
            DEG_COD: '*',
            HIS: 1,
            TYP: 1,
            page: page
        }
        for(let i in need) {
            if (i == 'crsname') continue;
            params[i] = need[i];
        }
        if (need['crsname']) {
            params['crsname'] = iconv.encode(need['crsname'], "Big5").reduce((current, buffer) => {
                return current+"%"+buffer.toString(16);
            }, "");
        }
        url += Object.keys(params).reduce((current, param) => {
            return `${current}${param}=${params[param]}&`;
        }, "?");
        request({
            url: url,
            // qs: params,
            method: "GET",
            mode: "cors",
            body: null,
            headers: {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                "accept-language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7", "upgrade-insecure-requests": "1"
            },
            encoding: null
        }, async function (error, response, body) {
            if (error || !body) {
                return;
            }
            const $ = cheerio.load(iconv.decode(body, "Big5"), { decodeEntities: false });
            if ($('span').last().text() == "這是最後一頁!!This is Last Page!!") {
                isEnd = true;
            }
            const tableTr = $('table tr');
            for(let i=3; i<tableTr.length-2; i++) {
                let row = tableTr.eq(i).find('td');
                /*
                4 = 課號
                7 = 課名
                14 = 餘額
                15 = 老師
                16 = 地點
                17 ~ 23 = 星期一 ~ 星期日
                */
                // for(let j=3; j<=24; j++) {
                //     console.log(row.eq(j).find('small').text());
                // }
                doSomething(row, type);
                //console.log(row.eq(7).find('small').text());
            }
            resolve(body);
        });
    });
};

function lock(row) {
    row['type'] = '必修';
    courses.push(row);
    for(let i=17; i<=23; i++) {
        let text = row.eq(i).find('small').text().trim(' ');
        if (text != "") {
            for(let x of text) {
                time_table[i-17][x] = courses.length - 1;
            }
        }
    }
}

async function getLock() {
    return new Promise(async(resolve, reject) => {
        for(let i of config.lock) {
            await takeClassPrePage(1, {
                "T3": i
            }, lock);
        }
        resolve();
    });
}

async function takeClassInfo(data, type) {
    console.log(data);
    return new Promise(async(resolve, reject) => {
        isEnd = false;
        for (let i = 1; !isEnd; i++) {
            await takeClassPrePage(i, data, processCourse, type);
            console.log(`take page ${i} finished!`);
            if (i % 10 == 0) {
                await setTimeout(() => { }, 5 * 1000);
            }
        }
        resolve();
    });
}

function checkTime(row) {
    for(let i=17; i<=23; i++) {
        let text = row.eq(i).find('small').text().trim(' ');
        if (text != "") {
            for(let x of text) {
                if (typeof(time_table[i-17][x]) == "number") {
                    return false;
                }
            }
        }
    }
    return true;
}

async function processCourse(row, type) {
    row['type'] = type;
    return new Promise((resolve, reject) => {
        let T3 = row.eq(4).find('small').text().trim(' '), crsname = row.eq(7).find('small').text().trim(' ');
        for (let i of config.filter.T3) {
            if (T3 == i) {
                resolve();
                return;
            }
        }
        for (let i of config.filter.crsname) {
            if (crsname.search(i) != -1) {
                resolve();
                return;
            }
        }
        if (!checkTime(row)) {
            resolve();
            return;
        }
        courses.push(row);
        for(let i=17; i<=23; i++) {
            let text = row.eq(i).find('small').text().trim(' ');
            if (text != "") {
                for(let x of text) {
                    time_table[i-17][x].push(courses.length - 1);
                }
            }
        }
        resolve();
    });
}

async function startSpider() {
    return new Promise(async(resolve, reject) => {
        for (let i of config.form.D1) {
            await takeClassInfo({
                "D1": i.data
            }, i.text);
        }
        for (let i of config.form.crsname) {
            await takeClassInfo({
                "crsname": i.data
            }, i.text);
        }
        resolve();
    });
}

function processIndexToData(index) {
    let row = courses[index];
    return {
        type: row['type'],
        value: `${row.eq(3).find('small').text().trim()}-${row.eq(7).find('small').text().trim(' ')}(${row.eq(4).find('small').text().trim(' ')})-${row.eq(15).find('small').text().trim(' ')}`
    };
}

async function main() {
    await getLock();
    await startSpider();
    let data = time_table.map((day) => {
        for (let i in day) {
            if (typeof(day[i]) == "number") {
                let result = processIndexToData(day[i]);
                day[i] = {};
                day[i][result['type']] = [result['value']];
            } else {
                day[i] = day[i].map((time) => {
                    return processIndexToData(time);
                }).reduce((result, current) => {
                    if (result[current['type']]) result[current['type']].push(current['value']);
                    else result[current['type']] = [current['value']];
                    return result;
                }, {});
            }
        }
        return day;
    });
    fs.writeFile('result.js', `let course = ${JSON.stringify(data)};`, (err) => {
        if (!err) {
            console.log('complete');
        }
    });
}

main();
