// ==UserScript==
// @name         Test Userscript
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  try to take over the world!
// @author       sj0225@icloud.com
// @match        https://b2b.10086.cn/b2b/main/listVendorNotice.html?noticeType=*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// ==/UserScript==

(function() {
    'use strict';

    function initStatus(name, total) {
        if (total <=0) console.log('Error: value of total error! total=', total);
        else {
            if (getStatus(name)) GM_deleteValue(name);
            setStatus(name, total, total, total);
        }
    }

    function setStatus(name, total, start, end) {
        if (start < 0 || start > total) console.log('Error: value of start error! start=', start);
        else if (end < 0 || end > total) console.log('Error: value of end error! end=', end);
        else GM_setValue(name, {total:total, start: start, end:end});
    }

    function getStatus(name){
        return GM_getValue(name)
    }

    function updateStatus(name, new_total) {
        const now = getStatus(name);
        if (new_total == now.total) return;
        else if (new_total > now.toal) setStatus(name, new_total, now.start, now.end);
        else {
            console.log('Error: update status of new total error! new_total=', new_total);
            printStatus(name);
        }
    }

    function printStatus(name) {
        const s = getStatus(name);
        console.log('type_id=', name, ', total=', s.total, ', start=', s.start, ', end=',s.end)
    }

    function nextStep(name, records_in_page, page_size) {
        printStatus(name);
        const now = getStatus(name);
        setStatus(name, now.total, now.start, now.end - records_in_page); // 刷新status并持久化

        if (now.end - records_in_page > 0) { // 首先判断尾部非空，优先寻找下一页
            return Math.floor((now.total - records_in_page) / page_size) + 1; // 返回正数，next按钮
        } else if (now.start < now.total) { // 还有头部，寻找上一页
            return -(Math.floor((now.total - now.start) / page_size) + 1); // 返回负数，previous按钮
        } else return 0; // 头尾都空，可以退出Main循环了！
    }

    const active_page_selector = 'a.current'; // 这是按钮的位置，还有一个<input>的selector是 <input type="hidden" name="page.currentPage" value="3">
    const page_size_selector = '[name="page.perPageSize"]';
    const next_page_button_selector = '#pageid2 > table > tbody > tr > td:nth-child(4) > a';
    const previous_page_button_selector = '#pageid2 > table > tbody > tr > td:nth-child(2) > a';
    const first_notice_selector = '#searchResult > table > tbody > tr:nth-child(3)';
    const record_count_selector = '#pageid2 > table > tbody > tr > td:nth-last-child(3)'; // 倒数第三个

    const post_url = 'http://www.caogo.cn/notices';
    const content_base_url = 'https://b2b.10086.cn/b2b/main/viewNoticeContent.html?noticeBean.id=';

    // Main入口
    (async function(){
        console.log('Debug: start main ...');
        await waitForSelector(window, active_page_selector); // 提取当前活跃焦点的Page序号
        const type_id = window.location.search.split('=')[1]; // 取出url的参数值 [1,2,3,7,8,16]
        const page_size = getPageSize(window.document);
        let total = getTotoalRecords(window.document);

        // Todo: now for test!!! 下一步改为断点方式
        if (total <=0) console.log('Error: value of total error! total=', total);
        else {
            if (getStatus(type_id)) GM_deleteValue(type_id);
            setStatus(type_id, total, total, total);
            //printStatus(type_id)
        }

        do {
            let page_now = Number(document.querySelector(active_page_selector).textContent);
            let records_in_page = getRecordsInPage(document);
            console.log('Info(main): page_now=', page_now, '，爬取&发送数据');

            /*
            await getNoticeList(document, 'TM', notice_type_id).then( // 分析页面获得公告列表的数据
                response => console.log(response), // #TODO: 分析XHR结果，如果全部数据重复，说明页面无更新，需要想办法退出main()
                error => console.error(error)
            );
            */

            const next_page = nextStep(type_id, records_in_page, page_size);
            if ( next_page > 0) {
                let next_page_btn = document.querySelector(next_page_button_selector); // 寻找‘下一页’按钮
                if (next_page_btn) {
                    console.log('Info(main): Pause 5 seconds, then start to scrapy next page');
                    next_page_btn.onclick(); // 模拟click动作
                    await sleep(5000);
                }
            } else if (next_page < 0) {
                let previous_page_btn = document.querySelector(previous_page_button_selector); // 寻找‘下一页’按钮
                if (previous_page_btn) {
                    console.log('Info(main): Pause 5 seconds, then start to scrapy previous page');
                    previous_page_btn.onclick(); // 模拟click动作
                    await sleep(5000);
                }
            } else {
                console.log('Info(main): Scrapy data compeleted !!!');
                break;
            }

            await waitForSelector(window, active_page_selector); // 等待click后的页面更新
            updateStatus(type_id, getTotoalRecords(window.document));
        } while(1);
        console.log('The End...');
    }
    )();

    function getRecordsInPage(doc) {
        return doc.querySelectorAll('#searchResult > table > tbody > tr').length -2; // 带2个表头
    }

    // Func: 从DOM中读取记录总数
    function getTotoalRecords(doc) {
        const str = doc.querySelector(record_count_selector).innerText.trim(); // 典型格式为：‘共292,298条数据/14,615页’
        if (str.startsWith('共')) {
            const records = Number(str.split('/')[0].slice(1,-3).replace(',',''));
            if (records > 0) return records;
            else return 0;
        }
        else return 0;
    }

    // Func: 从DOM中获取每页的记录数
    function getPageSize(doc) {
        const str = doc.querySelector(page_size_selector).value;
        const page_size = Number(str);
        if (page_size > 0) return page_size;
        else return 0;
    }

    function waitForSelector(page, id){
        return new Promise((resolve, reject)=> {
            const retry_delay = 500;
            const retry_limits = 5;

            // console.log('Debug(waitforNode): start looking for node with ', selector_id);
            let retry_cnt = 0;
            setInterval(function myVar(){
                if (page.document.querySelector(id)) {
                    clearInterval(myVar);
                    resolve(page.document);
                } else if (retry_cnt >= retry_limits) {
                    clearInterval(myVar);
                    reject('Error(waitForSelector->myTimer): Failed searching for node=', id);
                } else retry_cnt++;
            }, retry_delay);
        })
    }

    function sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
})();