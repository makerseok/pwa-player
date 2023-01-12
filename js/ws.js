const host = 'cs.raiid.ai';
const port = 9001;

let mqtt;

function onConnect() {
  console.log('connected!');
  let mainTopic = `/ad/${player.deviceId}/+`;
  mqtt.subscribe(mainTopic);
  console.log(mainTopic + ' subscribed!');
}

function onFailure() {
  console.log('Connection Failed!');
}

async function onMessageArrived(res) {
  const event = res.destinationName.replace(/\/ad\/[a-zA-Z0-9]*\//, '');
  const payload = JSON.parse(res.payloadString);
  const uuid = payload.UUID;
  const result = { event, uuid };

  const count = await db.websockets.where(result).count();
  if (count === 0) {
    try {
      await db.websockets.add(result);
      switch (event) {
        case 'ead':
          console.log('run getEads!');
          const eads = await getDataFromUrl(EADS_URL);
          scheduleEads(eads);
          break;
        case 'rad':
          console.log('run getRads!');
          await initPlayerWithApiResponses(true);
          break;
        case 'screen':
          console.log('run getPlayerUi!');
          const device = await getDataFromUrl(DEVICE_URL);
          setPlayerUi(device);
          break;

        default:
          break;
      }
      await postWebsocketResult(result);
    } catch (error) {
      console.log('error on websocket', error);
    }
  }
}

const initWebsocket = () => {
  const options = {
    useSSL: true,
    timeout: 3,
    onSuccess: onConnect,
    onFailure: onFailure,
    userName: 'spacebank',
    password: 'demo00',
  };
  const clientId = 'client-' + Math.random().toString().split('.')[1];

  mqtt = new Paho.MQTT.Client(host, port, clientId);

  mqtt.onMessageArrived = onMessageArrived;
  mqtt.connect(options);
};
