// ==UserScript==
// @name         Test Userscript
// @namespace    http://tampermonkey.net/
// @version      0.51
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

    const BREAKPOINT_MODE = true;
    const settings = {
        selector: {
            page_size: '[name="page.perPageSize"]', // 页面尺寸
            current_page: '[name="page.currentPage"]', // .value是当前页面序号，还有一个方法是'a.current'.innerText
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

    function nextStep(id, page_info) {
        let now = getStatus(id);
        if (now.end > 0) { // 尾部还没读完
            const new_end = page_info.total - ((page_info.current_page - 1) * page_info.page_size) - page_info.records_in_page;
            setStatus(id, now.total, now.start, new_end); // 刷新status并持久化
        } else if (now.start < now.total) { // 头部还没读完
            const new_start = page_info.total - ((page_info.current_page - 1) * page_info.page_size);
            setStatus(id, now.total, new_start, now.end); // 刷新status并持久化
        }

        now = getStatus(id);
        if (now.end > 0) return 'forward';
        else if (now.start < now.total) return 'backward';
        else return 'stop';
    }

    // Main入口
    (async function(){
        console.log('Debug: start main ...');
        await waitForSelector(window, settings.selector.current_page); // 提取当前活跃焦点的Page序号

        const type_id = window.location.search.split('=')[1]; // 取出url的参数值 [1,2,3,7,8,16]
        let page_info = preReadPage(window.document);
        let status = getStatus(type_id);
        if (!BREAKPOINT_MODE || status == null) {
            console.log('Info:(main) 断点日志不存在，自动创建之...');
            setStatus(type_id, page_info.total, page_info.total, page_info.total);
            console.log(reprStatus(type_id));
            status = getStatus(type_id);
        } else if (status.total < page_info.total) { // 断点以来有新的记录
            console.log('Info(main): 发现自断点以来的新记录，刷新GM状态数据...');
            updateTotal(type_id, page_info.total);
            status = getStatus(type_id);
        }

        // let direction = isContinue(status);
        if (BREAKPOINT_MODE) {
            console.log('Info(main): 本次程序运行在断点模式...');
            let page_no = 0;
            if (status.end > 0) {
                page_no = Math.floor((status.total - status.end) / page_info.page_size) + 1;
            }
            else if (status.total > status.start) {
                page_no = Math.floor((status.total - status.start) / page_info.page_size) + 1;
            }
            else {
                console.log('Info(main): 没有新数据，本次运行即将结束');
                return 0;
            }
            if (page_no != page_info.current_page) {
                console.log('Info(main): 准备跳转到断点页面，页码=', page_no, ', type=', typeof(page_no));
                await gotoPage(page_no);
                page_info = preReadPage(window.document);
                status = updateTotal(type_id, page_info.total);
                //direction = isContinue(status);
            }
        } else {
            console.log('Info(main): 本次程序运行在全新模式，默认从第1页开始...');
        }

        do {
            console.log(reprStatus(type_id));
            console.log('Info(main): page_now=', page_info.current_page, '，爬取&发送数据');
            readPage(document);
            const direction = nextStep(type_id, page_info);
            switch (direction) {
                case 'stop':
                    console.log('Info(main): 没有新数据，本次运行即将结束');
                    return 0;
                case 'forward':
                    if (page_info.next_page_button == null) console.log('Error(main): 主循环控制错误，找不到next按钮');
                    else {
                        console.log('Info(main): Pause 5 seconds, then start to scrapy next page');
                        page_info.next_page_button.onclick(); // 模拟click ‘下一页’按钮
                    }
                    break;
                case 'backword':
                    if (page_info.previous_page_btn == null) console.log('Error(main): 主循环控制错误，找不到previous按钮');
                    else {
                        console.log('Info(main): Pause 5 seconds, then start to scrapy previous page');
                        page_info.previous_page_button.onclick(); // 模拟click ‘上一页’按钮
                    }
                    break;
            }
            await sleep(5000);
            await waitForSelector(window, settings.selector.current_page); // 等待click后的页面更新
            page_info = preReadPage(window.document);
            status = updateTotal(type_id, page_info.total);
            //direction = isContinue(status);
        } while(1);
    }
    )();

    async function gotoPage(pageNumber){
        if (typeof(pageNumber) != 'number' || pageNumber <= 0 ) {
            alert('Error(gotoPage): 输入参数错误， pageNumber=' + toString(pageNumber));
            return -1;
        }
        document.querySelector(settings.selector.page_number_input).value = pageNumber; // 模拟输入‘页码’
        document.querySelector(settings.selector.goto_page_button).onclick(); //模拟点击‘GO’按钮
        await sleep(5000); // 等待页面刷新
        await waitForSelector(window, settings.selector.current_page);

        let x = document.querySelector(settings.selector.current_page).value;
        if (Number(x) == pageNumber) console.log('Info(gotoPage): 成功调转到断点页码， 当前页码=', x );
        else {
            alert('Error(gotoPage): 无法调转到断点页码， pageNumber=' + toString(pageNumber));
            return -2;
        }
    }

    function preReadPage(doc) {
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
            GM_setValue(id, {total:total, start: start, end:end});
            console.log('Debug(setStatus): status=', reprStatus(id));
            return getStatus(id);
        }
    }

    function getStatus(id){
        return GM_getValue(id);
    }

    function updateTotal(id, new_total) {
        const now = getStatus(id);
        if (new_total < now.total) {
            console.log('Error(updateStatus): update status of new total error! new_total=', new_total, ', status=', reprStatus(id));
            return null;
        } else if (new_total > now.total) {
            console.log('Info(updateStatus): find some new records! total=', now.total, ', new total=', new_total);
            GM_setValue(id, {total:new_total, start: now.start, end:now.end});
            console.log('Debug(updateStatus): status=', reprStatus(id));
        }
        console.log('Debug(updateStatus): ', reprStatus(id));
        return getStatus(id);
    }

    function reprStatus(id) {
        const s = getStatus(id);
        if (s == null) return 'err';
        return 'type_id=' + id + ', total=' + String(s.total) + ', start=' + String(s.start) + ', end=' + String(s.end);
    }

    function waitForSelector(page, id){
        return new Promise((resolve, reject)=> {
            const retry_delay = 500;
            const retry_limits = 5;
            let retry_cnt = 0;

            if (id == null) reject('Error(waitForSelector): argument id is null!');
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