import BeaconScanner from 'node-beacon-scanner';
const scanner = new BeaconScanner();
import axios from 'axios';
import mqtt from 'mqtt';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
import isOnline from 'is-online';

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
const heartBeatInterval = process.env.HEARTBEAT_INTERVAL;
// const scannedBLE = "f2ab73195979";

function run(){
  const mqttOptions = {
    host: endpoint,
    protocol: "mqtt",
    clientId: "sdk-nodejs-v2",
    clean: true,
    key: key,
    cert: cert,
    ca: ca,
    reconnectPeriod: 0,
    debug:true
  };

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
    var objData = JSON.parse(cleanData);
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

  async function checkAndSendData(scannedBLE, bleAddress, proximityUUID, rssi, txPower){

    var temp = fs.readFileSync("/sys/class/thermal/thermal_zone0/temp");
    var temp_c = temp/1000;

    const date = new Date();
    var sampleTime = date.getTime();

    const msg = {
      timestamp: sampleTime,
      deviceID: busStopObj.busStopID[nodeID.toString()].go.toString(),
      bleAddress: bleAddress,
      proximityUUID: proximityUUID,
      rssi: rssi,
      txPower: txPower,
      raspiTemp: temp_c
    };
    const json = JSON.stringify(msg);
    if (client){
        client.publish(topic, json, { qos: 0, retain: false }, (error) => {
            if (error){
                console.log(error)
            }
        })
    }
    

    if(await getETA(busObj.bleID[scannedBLE].busID, busStopObj.serviceNo, busStopObj.busRoutes.go, busStopObj.busStopID[nodeID.toString()].go)){
      const postData = JSON.stringify({
        bus_id: busObj.bleID[scannedBLE].busID,
        route_id: busStopObj.busRoutes.go,
        imei: bleAddress,
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
          imei: bleAddress,
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
            imei: bleAddress,
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
            imei: bleAddress,
            latlong: busStopObj.coordinate[nodeID.toString()],
            speed: 10
          });
          console.log('busInserLocation: ' + postData);
          busInsertLocation(postData);
        }
      }
    }
  }

  function heartBeat(){
    var temp = fs.readFileSync("/sys/class/thermal/thermal_zone0/temp");
    var temp_c = temp/1000;

    const date = new Date();
    var sampleTime = date.getTime();

    const msg = {
      timestamp: sampleTime,
      deviceID: busStopObj.busStopID[nodeID.toString()].go.toString(),
      heartBeat: 1,
      raspiTemp: temp_c
    };
    const json = JSON.stringify(msg);
    if (client){
        client.publish(topic, json, { qos: 0, retain: false }, (error) => {
            if (error){
                console.log(error)
            }
        })
    }
  }

  const client = mqtt.connect(mqttOptions);

  client.on('connect', function () {
      console.log("Connected to AWS IoT Core!")
  })

  setInterval(heartBeat, heartBeatInterval);

  scanner.onadvertisement = (ad) => {
    scanner.stopScan();
    console.log(ad);
    const scannedBLE = ad["id"];
    const bleAddress = ad["bleAddress"];
    const proximityUUID = ad["iBeacon"]["uuid"];
    const rssi = ad["rssi"];
    const txPower = ad["iBeacon"]["txPower"];

    if (Object.keys(busObj.bleID).includes(scannedBLE)){
      console.log('iBeacon of the bus is found!')
      checkAndSendData(scannedBLE, bleAddress, proximityUUID, rssi, txPower);
    }
    else console.log('Beacon detected, but not the Bus!')
  };

  // Start scanning
  scanner.startScan().then(() => {
      console.log('Started to scan.');
  }).catch((error) => {
      console.error(error);
  });
};

async function onlineCheck(){
  if(await isOnline()){
    console.log('Online and ready!');
    run();
  }
  else{
    console.error('Retrying to connect...');
    await onlineCheck();
  }
};

onlineCheck();
