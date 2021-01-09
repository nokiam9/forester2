// ==UserScript==
// @name         TM-b2bcmcc
// @namespace    www.caogo.cn
// @version      0.98c
// @description  scrapy notice info from DOM
// @author       sj0225@icloud.com
// @match        https://b2b.10086.cn/b2b/main/listVendorNotice.html?noticeType=*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @connect      www.caogo.cn
// @connect      127.0.0.1
// ==/UserScript==

(function() {
    'use strict';

    // 全局配置信息
    const settings = {
        //RESET_MODE: true, // 默认是断点恢复模式
        NUMBER_OF_PAGES_READ_PER_STARTUP: 25, // 每次运行读取的页面数量
        SECONDS_BEFORE_LAST_RUNTIME: 60*0, // 上次运行的间隔时间，以防止插件重复运行
        SPIDER: 'TM',
        TYPE_ID_GROUPS: ['1','2','3','7','8','16'],
        PAGE_SIZE: 20,
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
            notice_list: '#searchResult > table > tbody > tr', // 数据列表
            notice_content: '#contentInfo', // 用于判断新开content页面的完全加载
        },
        content_base_url: 'https://b2b.10086.cn/b2b/main/viewNoticeContent.html?noticeBean.id=',
        post_base_url: 'https://www.caogo.cn/notices',
        //post_base_url: 'http://127.0.0.1/api/notices/',
    };

    function nextPage(status, page_info){
        if (status.direction == 'stop') return 0;
        else if (status.direction == 'forward') {
            return Math.floor((page_info.total - status.end) / page_info.page_size) + 1;
        }
        else {
            return Math.floor((page_info.total - status.start - 1) / page_info.page_size) + 1; // backward
        }
    }

    // Main入口
    (async function(){
        //debugger;
        //showAllStatus();
        console.log('Info(main): start main at ', new Date().toISOString);
        const times = settings.NUMBER_OF_PAGES_READ_PER_STARTUP ? settings.NUMBER_OF_PAGES_READ_PER_STARTUP : 500;
        const type_id = window.location.search.split('=')[1]; // 取出url的参数值 [1,2,3,7,8,16]
        let status, page_info;

        if (settings.type_id_groups.indexOf(type_id) < 0) throw new Error('未知的type_id');
        if ((new Date().getTime() - settings.SECONDS_BEFORE_LAST_RUNTIME*1000) < lastRuntime()) throw new Error('启动等待间隔时间未到');

        await waitForSelector(window, settings.selector.current_page); // 异步等待当前页面完全加载
        page_info = getNoticeListInfo(window.document);
        if (page_info.page_size != settings.PAGE_SIZE) throw new Error('page_size != 20');
        status = getStatus(type_id);

        if (settings.RESET_MODE) { // 全新模式
            console.log('Info(main): 本次程序运行在全新模式，清理所有状态，并默认从第1页开始, 读取页面次数=', times);
            clearAllStatus();
            status = setStatus(type_id, page_info.total, page_info.total, page_info.total);
        } else { // 断点模式
            console.log('Info(main): 本次程序运行在断点模式，读取页面次数=', times);
            if (status == null) {
                console.log('Info:(main) 断点日志不存在，自动创建之...');
                status = setStatus(type_id, page_info.total, page_info.total, page_info.total);
            } else if (status.total < page_info.total) { // 页面有更新
                status = updateStatusTotal(type_id, page_info.total);
            }
            const page_no = nextPage(status, page_info);
            if (page_no == 0) {
                console.log('Info(main): 没有新数据，本次运行即将结束');
                return 0;
            } else if (page_no != page_info.current_page) { // 如果只新增几条记录，可能还在第一页
                console.log('Info(main): 准备跳转到断点页面，页码=', page_no);
                await gotoPage(page_no); // TODO: ????
                await sleep(5000);
                page_info = getNoticeListInfo(document);
                status = updateStatusTotal(type_id, page_info.total);
            }
        }

        for (let i = times; i > 0; i--) {
            // console.log('Info(main): ', reprStatus(type_id));
            console.log('Info(main): 正在处理的页面序号=', list_info.current_page, ', 当前页面记录数量=', list_info.records_in_page, '。 爬取 && 发送数据。。。');
            // 获取包含content的公告列表数组
            try {
                const notices = await getNoticeList(document, settings.SPIDER, type_id);
                for (let x of notices) await postOneNotice(x, settings.post_base_url); // 通过XHR发送数据
            } catch(error) {
                throw('Alex catched:' + error); // 经常出现DOM不完整的错误不好处理，直接退出下次再试
            }

            // 完成当前页面数据处理后，需要重置滑动窗口信息，并判断下一步的处理方式
            status = updateStatusStep(type_id, page_info);
            const page_no = nextPage(status, page_info);
            console.log('Info(main): 即将跳转到新页面，direction=', status.direction, ', page_no=',page_no);
            if (page_no == 0) {
                console.log('Info(main): 没有新数据，本次运行即将结束');
                return 0;
            } else if (page_no == page_info.current_page) {
                console.log('Warning(main): 主循环控制可能错误，jumpPage也许会陷入当前页面的死循环');
            }
            // 可能走到23页时突然发现新纪录，此时不能直接点击下一页，只能跳转到start所在页面，然后继续采用跳转方式往回走
            gotoPage(document, page_no); // gotoPage自带页面号码检查功能，此时DOM已经加载成功
            await sleep(5000);
            list_info = getNoticeListInfo(document);
            status = updateStatusTotal(type_id, page_info.total); //TODO: 这里还可能有问题，如果又更新了呢？？？
        }
        console.log('Info(main): 已经达到累计读取页面数量限制，本次运行即将结束！');
        return 1;
    }
    )();

    // Func: 向XHR发送一条公告数据，返回值：0-成功，-1重复记录
    function postOneNotice(notice, base_url){
        return new Promise((resolve, reject)=>{
            GM_xmlhttpRequest ({
                method:     "POST",
                url:        base_url, // TODO：base_url + notice.nid,
                data:       JSON.stringify(notice),
                onload:     function (response){
                    if (response.status == 200) resolve('ok'); // 插入成功
                    else if (response.status == 405) {
                        console.log('Warn(postOneNotice): XHR发现重复记录， nid=' + notice.nid);
                        resolve('duplicated'); // 重复记录，约定http返回码=405
                    }
                    else reject(response); // 未知应用错误
                },
                onerror: function(error){ // 网络错误
                    reject(error);
                }
            });
        });
    }

    // Func: 读取公告列表数据，并追加详情数据项
    function getNoticeList(doc, spider, type_id) {
        return new Promise((resolve, reject)=>{
            let notices = [];
            let line = document.querySelectorAll(settings.selector.notice_list)[2]; // 表头2行，数据从第三行开始
            while (line) {
                notices.push({
                    spider: spider,
                    type_id: type_id,
                    nid: line.getAttribute('onclick').split("'")[1],
                    source_ch: line.children[0].textContent,
                    notice_type: line.children[1].textContent,
                    title: line.children[2].children[0].textContent,
                    published_date: line.children[3].textContent,
                }); // 获得公告列表的基础信息
                line = line.nextElementSibling; // 循环提取下一行
            }

            // 新开窗口提取公告内容文本等数据

            (async () => {
                const ctw = window.open('', ''); // 打开一个临时窗口，用于提取内容文本，循环使用以节约资源
                if (ctw == null) reject('新开window失败，可能是被浏览器拦截');
                for (let x of notices) {
                    const url = settings.content_base_url + x.nid;
                    await getNoticeContent(ctw, url).then(
                        content => {
                            Object.assign(x, {notice_url: url});
                            Object.assign(x, {notice_content : content}); // 追加公告内容，后续增加附件下载功能
                            console.log('Info(getNoticeList): nid=', x.nid, ', title=', x.title.substr(0,30), ',length=', x.notice_content.length);
                        },
                        error => reject(error)
                    );
                };
                ctw.close();
                resolve(notices);
            })(); //定义异步、匿名、包裹函数，并立即执行
        })
    }

    // Func: 等待详情页面完全加载，并返回详情文本
    function getNoticeContent(page, url) {
        return new Promise((resolve,reject)=> {
            (async function (){
                const selector_id = settings.selector.notice_content;
                const min_length_of_content = 103;
                const retry_times = 3;

                try {
                    page.location.assign(url); // 打开内容网页
                    //console.log('Info(getContent): Open window with url=', url);
                    for (let i = retry_times; i > 0; i--) {
                        const doc = await waitForSelector(page, selector_id);
                        const str = doc.body.innerText.trim();
                        if (str.length <= min_length_of_content) {
                            console.log('Info(getNoticeContent): DOM内容不完整，再试一次..., url=' + url);
                            page.location.reload();
                            await sleep(1000);
                        } else resolve(str);
                    }
                    reject('DOM of content incompelete, url=' + url);
                } catch(error) { reject(url + ':' + error); }
            })(); // 定义异步函数并立即执行
        });
    }

    // Func: 跳转到指定页面
    async function gotoPage(page_no) {
        if (typeof(page_no) != 'number' || page_no <= 0 ) {
            console.log('Error(gotoPage): 输入参数错误， page_no=' + String(page_no));
            return -1;
        }
        document.querySelector(settings.selector.page_number_input).value = page_no; // 模拟输入‘页码’
        document.querySelector(settings.selector.goto_page_button).onclick(); //模拟点击‘GO’按钮
        await sleep(5000); // 等待页面刷新
        await waitForSelector(window, settings.selector.current_page);

        let x = document.querySelector(settings.selector.current_page).value;
        if (Number(x) == page_no) console.log('Info(gotoPage): 成功调转到断点页码， 当前页码=', x );
        else {
            console.log('Error(gotoPage): 无法调转到断点页码， page_no=' + String(page_no));
            return -2;
        }
    }

    // Func: 获取公告列表的底部页面信息
    function getNoticeListInfo(doc) { // TODO: try & catch
        try {
            const str = doc.querySelector(settings.selector.total_records).innerText.trim(); // 典型格式为：‘共292,298条数据/14,615页’
            return {
                total: Number(str.split('/')[0].slice(1,-3).replace(',','')),
                current_page: Number(doc.querySelector(settings.selector.current_page).value), // 当前页面序号
                page_size: Number(doc.querySelector(settings.selector.page_size).value),
                //previous_page_button: doc.querySelector(settings.selector.previous_page_button), // ‘上一页’按钮
                //next_page_button: doc.querySelector(settings.selector.next_page_button), // ‘下一页’按钮
                records_in_page: doc.querySelectorAll(settings.selector.notice_list).length - 2, // 带2个表头行
            }
        }
        catch (err) {
            console.log('Error(getNoticeListInfo): field type error in DOM, msg=', err);
            return null;
        }
    }

    // Func：根据status的timestamp信息，返回TM最近一次运行的时间
    function lastRuntime() {
        let last = 0;
        for (let x of GM_listValues()) {
            if (settings.type_id_groups.indexOf(x) >= 0) {
                const ts = GM_getValue(x).timestamp;
                if ( ts > last) last = ts;
            }
        }
        return last;
    }

    // Func: 强制清理所有GM存储的小工具
    function clearAllStatus() {
        for (let name of GM_listValues()) {
            console.log('Info(clearAllStatus): delete value of name=', name, ', value=', GM_getValue(name));
            GM_deleteValue(name);
        }
    }

    // Func: 显示所有GM存储数据的小工具
    function showAllStatus() {
        console.log('Info(showAllStatus):');
        for (let name of GM_listValues()) console.log(reprStatus(name));
    }

    // Func：设置滑动窗口信息，并给出下一步的direction
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
            let direction = 'forward'; // 默认值
            if (total > start) direction = 'backward';
            else if (end == 0) direction = 'stop';
            GM_setValue(id, {total:total, start:start, end:end, direction:direction, timestamp: new Date().getTime()});
            console.log('Debug(setStatus): ', reprStatus(id));
            return getStatus(id);
        }
    }

    // Func：简单地将滑动窗口的数据持久化
    function getStatus(id){
        return GM_getValue(id);
    }

    // Func：将滑动窗口的数据内容显示为字符串
    function reprStatus(id) {
        const s = getStatus(id);
        if (s == null) {
            console.log('Error(reprStatus): invaild status! id=', String(id));
            return null;
        }
        return 'type_id=' + id + ': total=' + s.total.toString() + ', start=' + s.start.toString()
            +', end=' + s.end.toString() + ', direction=' + s.direction 
            + ', timestamp=' + new Date(s.timestamp).toISOString();
    }

    // Func：当发现记录总数有新增时，更新滑动窗口的记录总数信息
    function updateStatusTotal(id, new_total) {
        const now = getStatus(id);
        if (new_total < now.total) {
            console.log('Error(updateStatus): update status of new total error! new_total=', new_total, ', status=', reprStatus(id));
            return null;
        } else if (new_total > now.total) {
            console.log('Info(updateStatus): 发现', new_total-now.total, '条新纪录！！！ total=', now.total, ', new total=', new_total);
            setStatus(id, new_total, now.start, now.end);
        }
        return getStatus(id);
    }

    // Func：在读取数据列表成功后，更新滑动窗口的步长信息
    function updateStatusStep(id, page_info) {
        let now = getStatus(id);
        if (now.direction == 'backward') { // 头部还没读完
            const start1 = page_info.total - ((page_info.current_page - 1) * page_info.page_size);
            setStatus(id, now.total, start1, now.end); // 刷新status并持久化
        } else if (now.direction == 'forward') { // 尾部还没读完
            const end1 = page_info.total - ((page_info.current_page - 1) * page_info.page_size) - page_info.records_in_page;
            setStatus(id, now.total, now.start, end1); // 刷新status并持久化
        }
        return getStatus(id);
    }

    // Func：异步等待DOM全网加载，直到指定元素出现
    function waitForSelector(page, id){
        return new Promise((resolve, reject)=> {
            const retry_delay = 500;
            const retry_limits = 10;
            let retry_cnt = 0;

            if (id == null) reject('Error(waitForSelector): argument id is null!');
            setInterval(function myVar(){
                if (page.document.querySelector(id)) {
                    clearInterval(myVar);
                    resolve(page.document);
                } else if (retry_cnt >= retry_limits) {
                    clearInterval(myVar);
                    reject('Error(waitForSelector->myTimer): Failed searching for node=' + id);
                } else retry_cnt++;
            }, retry_delay);
        })
    }

    // Func：异步睡觉等待
    function sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
})();