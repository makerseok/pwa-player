const dbName = 'ReportsDB';
const dbVersion = 12;

let db = new Dexie(dbName);

/* 이름이 ReportsDB이고 버전 11인 데이터베이스 생성. 또한 데이터베이스에 5개의 테이블을 생성 */
db.version(dbVersion).stores({
  reports: '++,PLAY_ON',
  caches: '++id,cachedOn,deviceId,[cachedOn+deviceId]',
  deviceIds: '++,deviceId',
  websockets: '++,event,uuid,[event+uuid]',
  lastPlayed: 'deviceId,videoIndex,category,slot,fileId',
});
