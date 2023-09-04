const BeaconScanner = require('node-beacon-scanner');
const scanner = new BeaconScanner();
const https = require('https');
const axios = require('axios');
const mqtt = require('mqtt')
const fs = require('fs');
const { error } = require('console');
require('dotenv').config()

const ca = fs.readFileSync(process.env.CA, 'utf8');
const cert = fs.readFileSync(process.env.CERT, 'utf8');
const key = fs.readFileSync(process.env.KEY, 'utf8');
const endpoint = process.env.ENDPOINT
const topic = process.env.TOPIC;
const bus = fs.readFileSync(process.env.BUS,'utf8');
const busObj = JSON.parse(bus);
const busStop = fs.readFileSync(process.env.BUS_STOP,'utf8');
const busStopObj = JSON.parse(busStop);
const API_getETA = process.env.API_GET_ETA;
const API_busInsertLocation = process.env.API_INSERT_BUS_LOCATION;
const tresholdHour = Number(process.env.TRESHOLD_HOUR);
const nodeID = busStopObj.nodeID;
// const scannedBLE = "f2ab73195979";

async function getETA(busID, serviceNo, routeID, busStopID){
  const postData = JSON.stringify({
    bus_id: busID,
    service_no: serviceNo,
    route_id: routeID,
    bus_stop_id: busStopID
  })
  console.log('getETA:' + postData);
  const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
    };
  try {
    const response = await axios.post(API_getETA, postData, options);
    var etaStatus = response.status;
    var etaData = response.data;
  } catch (error) {
    var etaStatus = error.response["status"];
    var etaData = error.response["data"];
  }
  console.log(etaStatus);
  console.log(etaData);

  const sData = JSON.stringify(etaData);
  var cleanData = '';
  for(let i = 0; i < sData.length; i++){
    if((sData[i] !== "[") && (sData[i] !== "]")){
      cleanData += sData[i]
    }
  }
  objData = JSON.parse(cleanData);
  if(objData.route_id === routeID) return true; 
  else if(etaData === 'No bus service found') return false;
  else return false;
}

async function busInsertLocation(postData){
  const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
  try {
      const response = await axios.post(API_busInsertLocation, postData, options);
      console.log('Response:', response.data);
  } catch (error) {
      console.log(error.response["data"]);
  }
  scanner.startScan().then(() => {
    console.log('Started to scan.');
  }).catch((error) => {
    console.error(error);
  });
}

async function checkAndSendData(scannedBLE){
  if(await getETA(busObj.bleID[scannedBLE].busID, busStopObj.serviceNo, busStopObj.busRoutes.go, busStopObj.busStopID[nodeID.toString()].go)){
    const postData = JSON.stringify({
      bus_id: busObj.bleID[scannedBLE].busID,
      route_id: busStopObj.busRoutes.go,
      imei: busObj.bleID[scannedBLE].bleAddress,
      latlong: busStopObj.coordinate[nodeID.toString()],
      speed: 10
    });
    console.log('busInserLocation: ' + postData);
    busInsertLocation(postData);
  }
  else{
    if(await getETA(busObj.bleID[scannedBLE].busID, busStopObj.serviceNo, busStopObj.busRoutes.back, busStopObj.busStopID[nodeID.toString()].back)){
      const postData = JSON.stringify({
        bus_id: busObj.bleID[scannedBLE].busID,
        route_id: busStopObj.busRoutes.back,
        imei: busObj.bleID[scannedBLE].bleAddress,
        latlong: busStopObj.coordinate[nodeID.toString()],
        speed: 10
      });
      console.log('busInserLocation: ' + postData);
      busInsertLocation(postData);
    }
    else{
      const time = new Date();
      let hour = time.getHours();
      if(hour <= tresholdHour){
        const postData = JSON.stringify({
          bus_id: busObj.bleID[scannedBLE].busID,
          route_id: busStopObj.busRoutes.go,
          imei: busObj.bleID[scannedBLE].bleAddress,
          latlong: busStopObj.coordinate[nodeID.toString()],
          speed: 10
        });
        console.log('busInserLocation: ' + postData);
        busInsertLocation(postData);
      }
      else{
        const postData = JSON.stringify({
          bus_id: busObj.bleID[scannedBLE].busID,
          route_id: busStopObj.busRoutes.back,
          imei: busObj.bleID[scannedBLE].bleAddress,
          latlong: busStopObj.coordinate[nodeID.toString()],
          speed: 10
        });
        console.log('busInserLocation: ' + postData);
        busInsertLocation(postData);
      }
    }
  }
}

// checkAndSendData();

// console.log(Object.keys(busObj.bleID));
// if (Object.keys(busObj.bleID).includes(scannedBLE)) console.log('OK');


scanner.onadvertisement = (ad) => {
  scanner.stopScan();
  console.log(ad);
  const scannedBLE = ad["id"];
  if (Object.keys(busObj.bleID).includes(scannedBLE)){
    console.log('iBeacon of the bus is found!')
    checkAndSendData(scannedBLE);
  }
  else console.log('Beacon detected, but not the Bus!')
};

// Start scanning
scanner.startScan().then(() => {
    console.log('Started to scan.');
}).catch((error) => {
    console.error(error);
});

// const deviceList = [
//   "f2ab73195979",                 
//   "6055f9716c62"
// ]

// const client = mqtt.connect(
//   {
//     host: endpoint,
//     protocol: "mqtt",
//     clientId: "sdk-nodejs-v2",
//     clean: true,
//     key: key,
//     cert: cert,
//     ca: ca,
//     reconnectPeriod: 0,
//     debug:true,
//   }
// );

// client.on('connect', function () {
//     console.log("Connected!")
// })

// scanner.onadvertisement = (ad) => {
//   var temp = fs.readFileSync("/sys/class/thermal/thermal_zone0/temp");
//   var temp_c = temp/1000;

//   const date = new Date();
//   sampleTime = date.getTime();

//   const msg = {
//     timestamp: sampleTime,
//     deviceID: deviceID,
//     bleAddress: ad["address"],
//     proximityUUID: ad["iBeacon"]["uuid"],
//     rssi: ad["rssi"],
//     txPower: ad["iBeacon"]["txPower"],
//     raspiTemp: temp_c
//   };
//   const json = JSON.stringify(msg);
//   // dataLog.log(json);
//   if (deviceList.includes(ad["id"])){
//     console.log('iBeacon is found!')
//     if (client){
//         client.publish(topic, json, { qos: 0, retain: false }, (error) => {
//             if (error){
//                 console.log(error)
//             }
//         })
//     }
//   }
//   console.log(json)
// };

// // Start scanning
// scanner.startScan().then(() => {
//     console.log('Started to scan.')  ;
// }).catch((error) => {
//     console.error(error);
// });


