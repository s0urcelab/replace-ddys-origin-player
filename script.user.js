// ==UserScript==
// @name         Replace ddys Origin Player
// @namespace    https://github.com/s0urcelab/replace-ddys-origin-player
// @version      1.0
// @description  替换ddys原始播放器，移除去广告限制，修复滚轮和全屏快捷键失效bug，优化选集功能，自动记忆选集和上次播放位置
// @author       s0urce
// @match        https://ddys.art/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ddys.art
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @require      https://fastly.jsdelivr.net/npm/xgplayer@2.31.2/dist/index.min.js
// @run-at       document-end
// ==/UserScript==

const $$ = (q) => document.querySelector(q)
const $$$ = (q) => document.querySelectorAll(q)

const globalStyle = `
.wp-playlist-tracks {
    display: none!important;
}
.wp-video-playlist {
    display: flex;
    padding: 0!important;
    border: none!important;
    background: none!important;
}
.tabs-root {
    width: 220px;
    display: flex;
    flex-direction: column;
    background-color: #2e2e2e;
    border-radius: 8px;
    margin-left: 10px;
    padding: 4px;
}
.tab-item {
    cursor: pointer;
    margin-bottom: 6px;
    padding: 8px;
    color: white;
    background-color: #5a5a5a;
    border-radius: 5px;
}
.tab-item.playing {
    font-weight: bold;
    color: #3a8fb7;
    background-color: #232323;
}
.tab-item:not(.playing):hover {
    background-color: #232323;
}
.tab-item > .indicator {
    height: 14px;
    width: 14px;
    font-size: 14px;
    margin-right: 5px;
}
`
function parseResUrl(d) {
    const domain = window.location.hostname
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            responseType: 'json',
            headers: {
                'referer': `https://${domain}/`
            },
            url: `https://${domain}/getvddr/video?id=${d.url}&dim=1080P&type=mix`,
            onload: res => {
                resolve({ ...d, url: res.response.url })
            },
            onerror: function (error) {
                reject(error)
            },
        })
    })
}

class Tabs {
    constructor(init) {
        this.root = init.root
        this.data = init.data
        this.onSelect = init.onSelect
        this.selectedKey = init.data[0].key
    }

    render(key = this.selectedKey) {
        // update selectedKey
        this.selectedKey = key
        // render dom
        this.root.innerHTML = this.data.reduce((acc, curr) => {
            const isTarget = key === curr.key
            return `${acc}
                <div class="tab-item ${isTarget ? 'playing' : ''}" data-tab-key="${curr.key}">
                ${isTarget ? '<img class="indicator" src="//s1.hdslb.com/bfs/static/jinkela/video/asserts/playing.gif"></img>' : ''}
                ${curr.label}
            </div>
            `
        }, '')
        // bind click
        const self = this
        for (const tabElment of this.root.children) {
            tabElment.onclick = function() {
                const tabKey = tabElment.dataset.tabKey
                const record = self.data.find(v => v.key === tabKey)
                self.render(tabKey)
                self.onSelect(tabKey, record)
            }
        }
    }
}

; (async function () {
    'use strict';

    const originContainer = $$('.wp-video-playlist')
    // cannot found Player, quit
    if (!originContainer) return;

    // inject global style
    GM_addStyle(globalStyle)
    // hide origin container
    for (const item of originContainer.children) {
        item.style.display = 'none'
    }

    // append container for xgplayer
    originContainer.innerHTML += `<div id="xgplayer"></div><div class="tabs-root"></div>`
    // get video resource from page data
    const res = JSON.parse($$('.wp-playlist-script').textContent)
    const resPromise = res.tracks
        .map((track, idx) => ({ key: `${idx + 1}`, label: track.caption, url: track.src1 }))
        .map(parseResUrl)
    const resGroups = await Promise.all(resPromise)

    // init xgplayer
    const isWatched = window.localStorage[location.pathname]
    const initEp = isWatched ? JSON.parse(isWatched).ep : '1'
    const initPlayUrl = resGroups.find(v => v.key === initEp).url

    const player = new window.Player({
        id: 'xgplayer',
        url: initPlayUrl,
        fluid: true,
        videoInit: true,
        lastPlayTimeHideDelay: 3,
        ...isWatched && {lastPlayTime: JSON.parse(isWatched).seek},
    })

    // init tabs
    const tabs = new Tabs({
        root: $$('.tabs-root'),
        data: resGroups,
        onSelect: (key, record) => {
            player.src = record.url
            player.play()
        }
    })
    // render tabs
    tabs.render(initEp)

    // update video progress
    player.on('timeupdate', function({ currentTime }) {
        window.localStorage[location.pathname] = JSON.stringify({
            seek: currentTime,
            ep: tabs.selectedKey,
        })
    })

})()
