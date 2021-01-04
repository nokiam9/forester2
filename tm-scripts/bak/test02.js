// ==UserScript==
// @name         New Userscript
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// ==/UserScript==

(function() {
    'use strict';

    const type_id = '8';
    const page_size = 20;
    const total = 127;

    function setStatus(name, total, from, to){
        GM_setValue(name, {total:total, from: from, to:to});
    }

    function getStatus(name){
        return GM_getValue(name)
    }

    function updateStatus(name, new_total) {
        const old = getStatus(name);
        setStatus(name, new_total, old.from, old.to);
    }

    function printStatus(name) {
        const s = getStatus(name);
        console.log('type_id=', name, ', total=', s.total, ', from=', s.from, ', to=',s.to)
    }

    function goSteps(type_id, steps) {
        const old = getStatus(type_id);
        if (steps > 0) setStatus(type_id, old.total, old.from, old.to - steps); // 向尾部走
        else setStatus(type_id, old.total, old.from - steps, old.to); // 向头部走
    }

    function nextPage(type_id, now_total) {
        const now = getStatus(type_id);
        if (now.to > 0) { // 先走尾部，寻找下一页
            return {next_page: Math.floor((now.total - now.to) / page_size) + 1,
                    direction: 'foraward'};
        }
        else if (now.from < total) { // 还有头部，寻找上一页
            return {next_page: Math.floor((now.total - now.from) / page_size) + 1,
                    direction: 'backward'};
        }
        else return 0; // 头尾都是空，正常结束
    }

    function readPage(page_no, direction) {
        const now = getStatus(type_id);
        if (now.to < page_no * page_size || now.to > (page_no + 1) * page_size) {
            console.log('Error: unvaild status or page_no. page_no=', page_no, ', direction=', direction)
            console.log(printStatus())
            return -1;
        }

        const steps = getRecordsInPage(page_no);
        console.log('Info: Open page ', page_no, ', and read ', steps, ' some new records...');

        if (direction == 'forward') {
            if (now.to - steps < 0) setStatus(type_id, now.total, now.from, 0);
            else setStatus(type_id, now.total, now.from, now.to - steps);
        } else { // 'backword'
            setStatus(type_id, now.total, now.total - (page_no - 1) * page_size, now.to);
        }
    }

    function getRecordsInPage(page_no) {
        return page_size;
    }

    function getTotal(doc) {
        return 127;
    }

    // Main入口
    (async function(){
        debugger;
        GM_deleteValue(type_id); // only for test
        console.log('Start...');

        let now = getStatus(type_id);
        let total=getTotal(window.document);
        if (now == null) setStatus(type_id, total, total, total);

        while (1) {
            let s = nextPage(type_id, 127);
            if (s == 0) break;
            else {
                const records = readPage(s.page_no, s.direction);
                goSteps(type_id, records);
                printStatus(type_id);
            }
        }
        console.log('The End...');
    }
    )();
})();