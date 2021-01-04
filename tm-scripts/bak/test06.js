// ==UserScript==
// @name         Test Userscript
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  try to take over the world!
// @author       sj0225@icloud.com
// @match        https://b2b.10086.cn/b2b/main/listVendorNotice.html?noticeType=*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    const settings = {
        //INIT_MODE: true, // 默认是断点恢复模式
        NUMBER_OF_PAGES_READ_PER_STARTUP: 5, // 每次运行读取的页面数量
        selector: {
            page_size: '[name="page.perPageSize"]', // 页面尺寸
            // 还有一个方法是：document.querySelector('a.current').innerText
            current_page: '[name="page.currentPage"]', // .value是当前页面序号
            // 还有一个方法是：document.querySelector('[name="page.totalRecordNum"').value
            total_records: '#pageid2 > table > tbody > tr > td:nth-last-child(3)', // 全部记录数信息，‘共292,298条数据/14,615页’
            previous_page_button: '#pageid2 > table > tbody > tr > td:nth-child(2) > a', // 上一页按钮
            next_page_button: '#pageid2 > table > tbody > tr > td:nth-child(4) > a', // 下一页按钮
            page_number_input: '#pageNumber', // 输入将要跳转的页面号
            goto_page_button: '#pageid2 > table > tbody > tr > td:nth-child(8) > input[type=button]', // go按钮
            record_list: '#searchResult > table > tbody > tr', // 数据列表
        },
        content_base_url: 'https://b2b.10086.cn/b2b/main/viewNoticeContent.html?noticeBean.id=',
        post_url: 'http://www.caogo.cn/notices/',
    };

    function readPage(doc) {
        /*
        await getNoticeList(document, 'TM', notice_type_id).then( // 分析页面获得公告列表的数据
            response => console.log(response), // #TODO: 分析XHR结果，如果全部数据重复，说明页面无更新，需要想办法退出main()
            error => console.error(error)
        );
        */
    }

    // Main入口
    (async function(){
        console.log('Debug: start main ...');
        const type_id = window.location.search.split('=')[1]; // 取出url的参数值 [1,2,3,7,8,16]
        let init_mode = settings.INIT_MODE ? settings.INIT_MODE : false;
        let times = settings.NUMBER_OF_PAGES_READ_PER_STARTUP ? settings.NUMBER_OF_PAGES_READ_PER_STARTUP : 100;

        await waitForSelector(document, settings.selector.current_page); // 提取当前活跃焦点的Page序号
        let page_info = preReadPage(window.document);
        let status = getStatus(type_id);

        if (init_mode) { // 全新模式
            console.log('Info(main): 本次程序运行在全新模式，默认从第1页开始, 读取页面数量=', times);
            status = setStatus(type_id, page_info.total, page_info.total, page_info.total);
        } else { // 断点模式
            console.log('Info(main): 本次程序运行在断点模式， 读取页面数量=', times);
            if (status == null) {
                console.log('Info:(main) 断点日志不存在，自动创建之...');
                status = setStatus(type_id, page_info.total, page_info.total, page_info.total);
            } else if (status.total < page_info.total) { // 页面有更新
                status = updateStatusTotal(type_id, page_info);
            }
            let page_no = 0;
            if (status.direction == 'stop') {
                console.log('Info(main): 没有新数据，本次运行即将结束');
                return 0;
            }
            if (status.direction == 'forward') page_no = Math.floor((page_info.total - status.end) / page_info.page_size) + 1;
            else page_no = Math.floor((page_info.total - status.start) / page_info.page_size) + 1; // backward
            if (page_no != page_info.current_page) { // 如果只新增几条记录，可能还在第一页
                console.log('Info(main): 准备跳转到断点页面，页码=', page_no, ', type=', typeof(page_no));
                await gotoPage(document, page_no);
                page_info = preReadPage(window.document);
                status = updateStatusTotal(type_id, page_info.total);
            }
        }

        do {
            console.log('Info(main): ', reprStatus(type_id));
            console.log('Info(main): page_now=', page_info.current_page, ', records_in_page=', page_info.records_in_page, '。 爬取 && 发送数据。。。');
            readPage(document);
            status = updateStatusStep(type_id, page_info);
            if (status.direction == 'stop') {
                console.log('Info(main): 没有新数据，本次运行即将结束');
                return 0;
            }
            if (status.direction == 'forward') {
                if (page_info.next_page_button) {
                    console.log('Info(main): Pause 5 seconds, then start to scrapy next page');
                    page_info.next_page_button.onclick(); // 模拟click ‘下一页’按钮
                } else console.log('Error(main): 主循环控制错误，找不到next按钮');
            } else { // backward
                if (page_info.previous_page_btn) {
                    console.log('Info(main): Pause 5 seconds, then start to scrapy previous page');
                    page_info.previous_page_button.onclick(); // 模拟click ‘上一页’按钮
                } else console.log('Error(main): 主循环控制错误，找不到previous按钮');
            }

            await sleep(3000);
            await waitForSelector(document, settings.selector.current_page); // 等待click后的页面更新
            page_info = preReadPage(window.document);
            status = updateStatusTotal(type_id, page_info.total);
            times--;
        } while(times > 0);
        console.log('Info(main): 已经达到累计读取页面数量限制，本次运行即将结束！');
    }
    )();

    async function gotoPage(doc, pageNumber){
        if (typeof(pageNumber) != 'number' || pageNumber <= 0 ) {
            console.log('Error(gotoPage): 输入参数错误， pageNumber=' + String(pageNumber));
            return -1;
        }
        document.querySelector(settings.selector.page_number_input).value = pageNumber; // 模拟输入‘页码’
        document.querySelector(settings.selector.goto_page_button).onclick(); //模拟点击‘GO’按钮
        await sleep(5000); // 等待页面刷新
        await waitForSelector(doc, settings.selector.current_page);

        let x = document.querySelector(settings.selector.current_page).value;
        if (Number(x) == pageNumber) console.log('Info(gotoPage): 成功调转到断点页码， 当前页码=', x );
        else {
            console.log('Error(gotoPage): 无法调转到断点页码， pageNumber=' + String(pageNumber));
            return -2;
        }
    }

    function preReadPage(doc) { // TODO: try & catch
        try {
            const str = doc.querySelector(settings.selector.total_records).innerText.trim(); // 典型格式为：‘共292,298条数据/14,615页’
            return {
                total: Number(str.split('/')[0].slice(1,-3).replace(',','')),
                current_page: Number(doc.querySelector(settings.selector.current_page).value), // 当前页面序号
                page_size: Number(doc.querySelector(settings.selector.page_size).value),
                previous_page_button: doc.querySelector(settings.selector.previous_page_button), // ‘上一页’按钮
                next_page_button: doc.querySelector(settings.selector.next_page_button), // ‘下一页’按钮
                records_in_page: doc.querySelectorAll(settings.selector.record_list).length - 2, // 带2个表头行
                    }
        }
        catch (err) {
            console.log('Error(preReadPage): field type error in DOM, msg=', err);
            return null;
        }
    }

    function setStatus(id, total, start, end) {
        if (start < 0 || start > total) {
            console.log('Error: value of start error! start=', start);
            return null;
        }
        else if (end < 0 || end > total) {
            console.log('Error: value of end error! end=', end);
            return null;
        }
        else {
            let direction = 'stop';
            if (end > 0) direction = 'forward';
            else if (total > start) direction = 'backwrad';
            GM_setValue(id, {total:total, start:start, end:end, direction:direction});
            console.log('Debug(setStatus): ', reprStatus(id));
            return getStatus(id);
        }
    }

    function getStatus(id){
        return GM_getValue(id);
    }

    function reprStatus(id) {
        const s = getStatus(id);
        if (s == null) {
            console.log('Error(reprStatus): invaild status! id=', String(id));
            return null;
        }
        return 'type_id=' + id + ': total=' + String(s.total) + ', start=' + String(s.start) + ', end=' + String(s.end) + ', direction=' + s.direction;
    }

    function updateStatusTotal(id, new_total) {
        const now = getStatus(id);
        if (new_total < now.total) {
            console.log('Error(updateStatus): update status of new total error! new_total=', new_total, ', status=', reprStatus(id));
            return null;
        } else if (new_total > now.total) {
            console.log('Info(updateStatus): find some new records! total=', now.total, ', new total=', new_total);
            setStatus(id, {total:new_total, start: now.start, end:now.end});
        }
        return getStatus(id);
    }

    function updateStatusStep(id, page_info) {
        let now = getStatus(id);
        if (now.end > 0) { // 尾部还没读完
            const new_end = page_info.total - ((page_info.current_page - 1) * page_info.page_size) - page_info.records_in_page;
            setStatus(id, now.total, now.start, new_end); // 刷新status并持久化
        } else if (now.start < now.total) { // 头部还没读完
            const new_start = page_info.total - ((page_info.current_page - 1) * page_info.page_size);
            setStatus(id, now.total, new_start, now.end); // 刷新status并持久化
        }
        return getStatus(id);
    }

    function waitForSelector(doc, id){
        return new Promise((resolve, reject)=> {
            const retry_delay = 500;
            const retry_limits = 10;
            let retry_cnt = 0;

            if (id == null) reject('Error(waitForSelector): argument id is null!');
            setInterval(function myVar(){
                if (doc.querySelector(id)) {
                    clearInterval(myVar);
                    resolve(doc);
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