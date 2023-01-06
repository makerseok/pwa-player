const BASE_URL =
  'https://g575dfbc1dbf538-cms.adb.ap-seoul-1.oraclecloudapps.com/ords/podo/v1/podo/';
const DEVICE_URL = 'devices';
const POSITION_URL = 'devices/position';
const POSITION_LOCKED_URL = 'devices/position/locked';
const RADS_URL = 'rads';
const CRADS_URL = 'crads';
const EADS_URL = 'eads';
const REPORT_URL = 'report';
const WEBSOCKET_URL = 'websocket';

const HS_API_KEY =
  '$2b$12$y4OZHQji3orEPdy2FtQJye:8f3bc93a-3b31-4323-b1a0-fd20584d9de4';

/* 폴리필 코드 */
if (!Promise.allSettled) {
  Promise.allSettled = function (promises) {
    return Promise.all(
      promises.map(p =>
        Promise.resolve(p).then(
          value => ({
            status: 'fulfilled',
            value,
          }),
          reason => ({
            status: 'rejected',
            reason,
          }),
        ),
      ),
    );
  };
}

/**
 * 일반재생목록과 device 정보를 api로 받아온 뒤 ui 및 player를 초기화
 *
 * @param { boolean } [sudo=false] true일 시 cached 여부에 상관없이 캐싱되지 않은 비디오 fetch
 */
const initPlayerWithApiResponses = async (sudo = false) => {
  try {
    const crads = await getDataFromUrl(CRADS_URL);
    const device = await getDataFromUrl(DEVICE_URL);
    initPlayer(crads, device, sudo);
  } catch (error) {
    console.log(error);
  }
};

/**
 * hivestack url에 광고 정보를 요청
 * retry 횟수 내에서 성공할 때까지 재귀적으로 실행
 * 실패시 { success: false } 반환
 *
 * @param {string} hivestackUrl 요청 대상 url
 * @param {number} [retry=0] 현재 재시도 횟수
 * @return { Promise<{ Object }> } hivestack 광고 정보
 */
const getUrlFromHS = async (hivestackUrl, retry = 0) => {
  let hivestackInfo = {};

  const HS_URL = hivestackUrl;
  if (retry > 2) {
    hivestackInfo.success = false;
    return hivestackInfo;
  }
  const response = await axios.get(HS_URL);

  const $xml = $.parseXML(response.data);
  const media = $xml.getElementsByTagName('MediaFile').item(0);
  const report = $xml.getElementsByTagName('Impression').item(0);
  if (!media) {
    hivestackInfo = await getUrlFromHS(hivestackUrl, retry + 1);
  } else if (media.getAttribute('type') !== 'video/mp4') {
    hivestackInfo = await getUrlFromHS(hivestackUrl, retry + 1);
  } else {
    hivestackInfo.success = true;
    hivestackInfo.videoUrl = media.textContent.trim();
    hivestackInfo.reportUrl = report.textContent.trim();
  }

  return hivestackInfo;
};

/**
 * 서버에서 받은 data 정보 반환
 */
const getDataFromUrl = async (url, headersObject = null) => {
  const headers = headersObject || {
    auth: player.companyId,
    device_id: player.deviceId,
  };

  const { data } = await axios.get(BASE_URL + url, { headers });
  return data;
};

/**
 * 파라미터로 받은 device 정보로 player UI 갱신
 *
 * @param { Object } device device 정보
 */
const setPlayerUi = device => {
  const position = {
    top: device.top,
    left: device.left,
    width: device.width,
    height: device.height,
  };
  initPlayerUi(position);
};

/**
 * 파라미터로 받은 player 위치, 크기 정보를 서버로 전송
 *
 * @param { Object } position player 위치 정보
 */
const postPlayerUi = async position => {
  const headers = {
    auth: player.companyId,
    device_id: player.deviceId,
  };

  axios
    .post(BASE_URL + POSITION_URL, position, { headers })
    .then(console.log('position posted!', position))
    .catch(error => console.log(error));
};

/**
 * 비디오 실행 결과를 서버로 post
 *
 * @param { Object[] } data 비디오 실행 결과
 * @return { any | Error } axios response 또는 Error
 */
const postReport = async data => {
  const headers = {
    auth: player.companyId,
    device_id: player.deviceId,
  };
  try {
    return await axios.post(BASE_URL + REPORT_URL, data, { headers });
  } catch (error) {
    return error;
  }
};

/**
 * 웹소켓 message에 대한 응답을 post
 *
 * @param {{ event:string, uuid:string }} data 이벤트, UUII 정보
 */
const postWebsocketResult = async data => {
  const headers = {
    auth: player.companyId,
    device_id: player.deviceId,
  };
  try {
    await axios.post(BASE_URL + WEBSOCKET_URL, data, { headers });
  } catch (error) {
    console.log('error on postWebsocketResult', error);
  }
};

/**
 * 긴급재생목록 schedule 함수
 *
 * @param {{ code: string, message:string, items: Object[] }} eadData 서버에서 api를 통해 전달받은 긴급재생목록 정보
 */
const scheduleEads = eadData => {
  player.jobs.forEach(e => {
    e.stop();
  });
  player.jobs = [];

  eadData.items.forEach(v => {
    const data = [
      {
        sources: [{ src: v.VIDEO_URL, type: 'video/mp4' }],
        isHivestack: v.HIVESTACK_YN,
        hivestackUrl: v.API_URL,
        runningTime: v.RUNNING_TIME,
        periodYn: v.PERIOD_YN,
        report: {
          COMPANY_ID: player.companyId,
          DEVICE_ID: player.deviceId,
          FILE_ID: v.FILE_ID,
          HIVESTACK_YN: v.HIVESTACK_YN,
          PLAY_ON: null,
        },
      },
    ];
    console.log('schedule ead', v);
    scheduleVideo(v.START_DT, data)
      .then(async job => {
        if (job) {
          player.jobs.push(job);
          if (v.PERIOD_YN === 'Y') {
            player.jobs.push(
              await scheduleVideo(v.END_DT, player.primaryPlaylist, true),
            );
          }
        }
      })
      .catch(error => {
        console.log('error on scheduleEads', error);
      });
  });
};

/**
 * 일반재생목록과 플레이어 정보를 받아 UI 및 player를 초기화
 *
 * @param { Object[] } crads 서버에서 api를 통해 전달받은 일반재생목록 정보
 * @param { Object } device 서버에서 api를 통해 전달받은 플레이어 정보
 * @param { boolean } [sudo=false] true일 시 cached 여부에 상관없이 캐싱되지 않은 비디오 fetch
 */
function initPlayer(crads, device, sudo = false) {
  const screen = crads.device_code;
  const { code, message, device_id, company_id, ...deviceInfo } = device;
  const { on, off, top, left, width, height, locked, ...rest } = deviceInfo;
  player.locked = locked === 'Y' ? true : false;
  const pos = { top, left, width, height };
  player.position = pos;

  const onDate = sethhMMss(new Date(), on);
  const offDate = sethhMMss(new Date(), off);

  player.runon = onDate;
  player.runoff = offDate > onDate ? offDate : addMinutes(offDate, 1440);

  removeDefaultJobs();
  scheduleOnOff(on, off);

  player.videoList = itemsToVideoList(crads);

  let urls = [];
  findData(crads, 'VIDEO_URL', (key, value, object) => urls.push(value));
  const deduplicatedUrls = [...new Set(urls)];

  fetchVideoAll(deduplicatedUrls, sudo).then(() => {
    console.log('finish fetching');
    renderVideoList(player.videoList);
    setDeviceConfig(deviceInfo);
    initPlayerUi(pos);

    const playlists = cradsToPlaylists(crads);
    const currentTime = addHyphen(getFormattedDate(new Date()));
    removeCradJobs();
    schedulePlaylists(playlists, currentTime);
    if (!mqtt) {
      initWebsocket();
    }
  });
}

/**
 * 주어진 두 수의 최대공약수 반환
 *
 * @param { number } a
 * @param { number } b
 * @return { number } a와 b의 최대공약수
 */
const gcd = (a, b) => {
  if (b === 0) return a; // 나누어지면 a 리턴
  return gcd(b, a % b); // 나누어지지 않는다면 b와 a%b를 다시 나눈다
};

/**
 * 주어진 두 수의 최소공배수 반환
 *
 * @param { number } a
 * @param { number } b
 * @return { number } a와 b의 최소공배수
 */
const lcm = (a, b) => (a * b) / gcd(a, b); // 두 수의 곱을 최대공약수로 나눈다.

/**
 * player에 저장된 모든 defaultJobs 정지 및 제거
 *
 */
const removeDefaultJobs = () => {
  player.defaultJobs.forEach(e => {
    e.stop();
  });
  player.defaultJobs = [];
};

/**
 * player에 저장된 모든 cradJobs 정지 및 제거
 *
 */
const removeCradJobs = () => {
  player.cradJobs.forEach(e => {
    e.stop();
  });
  player.cradJobs = [];
};

/**
 * 파라미터로 받아온 player 시작, 종료 시각 스케쥴링
 *
 * @param { string } on "HH:MM:SS" 형식의 시작 시각
 * @param { string } off "HH:MM:SS" 형식의 종료 시각
 */
const scheduleOnOff = (on, off) => {
  const runon = Cron(hhMMssToCron(on), () => {
    console.log('cron info - play on', hhMMssToCron(on));
    player.playlist.currentItem(0);
    player.play();
  });
  player.defaultJobs.push(runon);
  const runoff = scheduleOff(off);
  player.defaultJobs.push(runoff);
};

/**
 * 카테고리별 데이터를 현재 시간별로 분류해서 스케쥴링
 *
 * @param { Object[] } playlists 카테고리별 비디오 데이터
 * @param { string } currentTime "YYYY-MM-DD HH24:MI:SS" 형식 현재 시간
 */
function schedulePlaylists(playlists, currentTime) {
  for (let playlist of playlists) {
    console.log(
      currentTime,
      playlist.start,
      playlist.end,
      playlist.categoryName,
    );
    const startDate = new Date(playlist.start);
    const hhMMssEnd = gethhMMss(new Date(playlist.end));
    if (currentTime >= playlist.end) continue;
    if (currentTime >= playlist.start && currentTime < playlist.end) {
      initPlayerPlaylist(playlist.files);
      player.cradJobs.push(scheduleOff(hhMMssEnd));
    }
    if (currentTime < playlist.start) {
      console.log('더 작다!');
      const overlappingDateIndex = player.cradJobs.findIndex((job, index) => {
        return job.next().getTime() === startDate.getTime() && job.isEnd;
      });
      console.log(overlappingDateIndex);
      scheduleVideo(playlist.start, playlist.files, true)
        .then(job => {
          if (job) {
            if (overlappingDateIndex !== -1) {
              player.cradJobs[overlappingDateIndex].stop();
              player.cradJobs[overlappingDateIndex] = job;
            } else {
              player.cradJobs.push(job);
            }
            player.cradJobs.push(scheduleOff(hhMMssEnd));
          }
        })
        .catch(error => {
          console.log('error on scheduleEads', error);
        });
    }
  }
}

/**
 * 플레이어 종료 시각 스케쥴링
 *
 * @param { string } off "HH:MM:SS" 형식의 종료 시각
 * @return { Cron } 플레이어 종료 Cron 객체
 */
function scheduleOff(off) {
  const job = Cron(hhMMssToCron(off), () => {
    console.log('cron info - play off', hhMMssToCron(off));
    player.pause();
  });
  job.isEnd = true;
  return job;
}

/**
 * api response data 값을 파라미터로 넣을 시 category별로 data를 매칭한 Array 반환
 *
 * @param { Object[] } crads
 * @return { Object[] } 카테고리별 비디오 데이터
 */
function cradsToPlaylists(crads) {
  const tmpSlots = crads.slots.map(originSlot =>
    formatSlotToPlaylist(originSlot),
  );
  const slots = [...new Set(tmpSlots)];

  const playlists = crads.items.map(item => {
    const filteredSlots = slots.filter(
      slot => slot.categoryId === item.CATEGORY_ID,
    );
    return {
      categoryId: item.CATEGORY_ID,
      categoryName: item.CATEGORY_NAME,
      start: addHyphen(item.START_DT),
      end: addHyphen(item.END_DT),
      files: filteredSlots.length ? filteredSlots[0].files : [],
    };
  });
  return playlists;
}

/**
 * 일반재생목록 정보를 UI에 표시하기 위해 정제
 *
 * @param { code: string, message:string, items: Object[] } radList 서버에서 api를 통해 전달받은 일반재생목록 정보
 * @return { Object[] } 정제된 Array
 */
function itemsToVideoList(radList) {
  return radList.items.map((v, index) => {
    return {
      index: index + 1,
      runningTime: v.RUNNING_TIME,
      ad: v.D_FILE_NAME,
      type: v.TYP,
      start: new Date(v.START_DT).toLocaleDateString(),
      end: new Date(v.END_DT).toLocaleDateString(),
    };
  });
}

/**
 * 입력받은 객체를 playlist src 형식에 맞춰 반환
 *
 * @param { Object } file
 * @return { Object } playlist src 형식 객체
 */
const fileToPlaylistSrc = file => {
  return {
    sources: [{ src: file.VIDEO_URL, type: 'video/mp4' }],
    isHivestack: file.HIVESTACK_YN,
    hivestackUrl: file.API_URL,
    runningTime: file.RUNNING_TIME,
    report: {
      COMPANY_ID: player.companyId,
      DEVICE_ID: player.deviceId,
      FILE_ID: file.FILE_ID,
      HIVESTACK_YN: file.HIVESTACK_YN,
      // HIVESTACK_URL: file.VIDEO_URL,
      PLAY_ON: null,
    },
  };
};

/**
 * 주어진 slot들을 category별 slot 순서에 맞게 차원 축소
 *
 * @param { Object } originSlot
 * @return {{ categoryId: number, categoryName: string, files: Object[] }}
 */
function formatSlotToPlaylist(originSlot) {
  let formattedSlot = {
    categoryId: originSlot.CATEGORY_ID,
    categoryName: originSlot.CATEGORY_NAME,
    files: [],
  };
  const lengths = originSlot.slots.map(slot => slot.files.length);
  for (let i = 0; i < lengths.reduce(lcm); i++) {
    originSlot.slots.forEach(slot => {
      const src = fileToPlaylistSrc(slot.files[i % slot.files.length]);
      src.slotId = slot.SLOT_ID;
      src.slotName = slot.SLOT_NAME;
      src.categoryId = slot.CATEGORY_ID;
      formattedSlot.files.push(src);
    });
  }
  return formattedSlot;
}

/**
 * 위치 및 크기 조정 가능 여부를 서버에 전송
 *
 * @param { boolean } locked 위치 및 크기 잠금 여부
 * @return { any } axios response
 */
const postPositionLocked = locked => {
  const headers = {
    auth: player.companyId,
    device_id: player.deviceId,
  };
  const data = { locked: locked ? 'Y' : 'N' };
  return axios.post(BASE_URL + POSITION_LOCKED_URL, data, { headers });
};

/**
 * 입력받은 객체에서 target을 key로 갖는 모든 경우에 대해 콜백함수 todo 수행
 *
 * @param { Object } item 탐색 대상 객체
 * @param { string } target 찾고자 하는 key 값
 * @param { Function } todo key, value, object를 매개변수로 갖는 콜백 함수
 */
function findData(item, target, todo) {
  let array = Object.keys(item); //키값을 가져옴
  for (let i of array) {
    if (i === target) {
      // 키값이 찾고자 하는 키랑 일치하면
      todo(i, item[i], item); //콜백: 키, 값, 객체
    } else if (item[i].constructor === Object) {
      //객체면 다시 순회
      findData(item[i], target, todo);
    } else if (item[i].constructor === Array) {
      //배열이면 배열에서 순회
      let miniArray = item[i];
      for (let f in miniArray) {
        findData(miniArray[f], target, todo);
      }
    }
  }
}
