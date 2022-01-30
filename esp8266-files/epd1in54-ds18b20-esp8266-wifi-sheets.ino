
 /**
 *  @filename   :   epd1in54-ds18b20-esp8266-wifi-sheets.ino
 *  @brief      :   ESP8266 with 1.54in ePaper Display, DS18B20 Temperature Sensor, WiFi Connectivity and integration with Google Sheets
 *  @author     :   Stephen Julian
 *  @date       :   November 23 2018
 *
 *  Based on some or all of the following libraries and their tutorials:
 *  Library Header           Description
 *  WiFiClientSecure.h   :   WiFi connectivity
 *  HTTPSRedirect.h      :   Google Sheets connectivity
 *  ArduinoJson.h        :   Parsing of return string from server
 *  OneWire.h            :   One-wire protocol interface driver for temperature sensor
 *  DallasTemperature.h  :   Software library for DS18B20 temperature sensor
 *  SPI.h                :   SPI interface driver for ePaper module
 *  epd1in54.h           :   Software library for 1.54inch 200x200 pixel ePaper module 
 */

#include <OneWire.h>
#include <DallasTemperature.h>

#include <SPI.h>
#include "epd1in54.h"
#include "epdpaint.h"
#include "imagedata.h"

#include <HTTPSRedirect.h>
#include <ESP8266WiFi.h>

#define COLORED     0
#define UNCOLORED   1
#define DEBUG       1

// START TEMP SENSOR CODE
//pin definitions
const int pin1wire = 2;
//ds18b20 stuff
const int ds18Resolution = 12;
const int ds18count = 2;
DeviceAddress ds18addr[] = {
   { 0x28, 0xE5, 0xB3, 0x5C, 0x1E, 0x13, 0x01, 0x4E },
   { 0x28, 0xE7, 0x0B, 0x63, 0x04, 0x00, 0x00, 0x44 }
};
uint8_t ds18index[ds18count]; //index of this matches ds18addr and the value is the index the library sees
unsigned int ds18delay;
unsigned long ds18lastreq;
OneWire oneWire(pin1wire);
DallasTemperature ds18(&oneWire);
// END TEMP SENSOR CODE

/**
  * Due to RAM not enough in Arduino UNO, a frame buffer is not allowed.
  * In this case, a smaller image buffer is allocated and you have to 
  * update a partial display several times.
  * 1 byte = 8 pixels, therefore you have to set 8*N pixels at a time.
  */
unsigned char image[1024];
Paint paint(image, 0, 0);    // width should be the multiple of 8 
Epd epd;
unsigned long time_start_ms;
unsigned long time_now_s;
float tempsC[ds18count];
float tempsF[ds18count];

const char* ssid = "mySSID";
const char* password = "/Pa$$w0rd!!";

// The ID below comes from Google Sheets.
// Towards the bottom of this page, it will explain how this can be obtained
const char *GScriptId = "AKfycbzveNsiMnZUCRP1Q6w10ggrwLdyyR5ja55bK3TIQXlvsvMaGjXk";
//https://script.google.com/macros/s/AKfycbzveNsiMnZUCRP1Q6w10ggrwLdyyR5ja55bK3TIQXlvsvMaGjXk/exec
// Push data on this interval
const int dataPostDelay = 30000;  // 15 minutes = 15 * 60 * 1000

const char* host = "script.google.com";
const char* googleRedirHost = "script.googleusercontent.com";

const int httpsPort =  443;
HTTPSRedirect client(httpsPort);

// Prepare the url (without the varying data)
String url = String("/macros/s/") + GScriptId + "/exec?";

const char* fingerprint = "F0 5C 74 77 3F 6B 25 D7 3B 66 4D 43 2F 7E BC 5B E9 28 86 AD";
int counter = 0;
int timeLastPost = 0;

bool initSetupOK = false;
bool initEpaperOK = false;
bool initTempsOK = false;
bool initWiFiOK = false;

void setup() {
  Serial.begin(115200);
  Serial.println("setup() start");
  
  initEpaperOK = SetupEpaper();
  if(initEpaperOK) {
    Serial.println("initEpaperOK");
    initTempsOK = SetupTempSensors();
    if(initTempsOK) {
      Serial.println("initTempsOK");
      initWiFiOK = SetupWiFi();
      if(initWiFiOK) {
        Serial.println("initWiFiOK");
        initSetupOK = true;
      }
    }
  }
  if(initSetupOK) {
    Serial.println("initSetupOK");
  } else {
    Serial.println("initSetupOK = false!");
  }
  Serial.println("setup() done");
  Serial.flush();
}

bool SetupEpaper() {
  Serial.println("e-paper setup start");
  if(epd.Init(lut_full_update) != 0) {
      Serial.println("e-Paper init failed #1");
      return false;
  }
  Serial.flush();
  /** 
   *  Note from epaper library developer: 
   *  there are 2 memory areas embedded in the e-paper display
   *  and once the display is refreshed, the memory area will be auto-toggled,
   *  i.e. the next action of SetFrameMemory will set the other memory area
   *  therefore you have to clear the frame memory twice.
   */
  epd.ClearFrameMemory(0xFF);   // bit set = white, bit reset = black
  epd.DisplayFrame();
  epd.ClearFrameMemory(0xFF);   // bit set = white, bit reset = black
  epd.DisplayFrame();
  paint.SetRotate(ROTATE_0);
  paint.SetWidth(200);
  paint.SetHeight(24);
  /* For simplicity, the arguments are explicit numerical coordinates */
  paint.Clear(COLORED);
  paint.DrawStringAt(30, 4, "Hello world!", &Font16, UNCOLORED);
  epd.SetFrameMemory(paint.GetImage(), 0, 10, paint.GetWidth(), paint.GetHeight());
  paint.Clear(UNCOLORED);
  paint.DrawStringAt(30, 4, "e-Paper Demo", &Font16, COLORED);
  epd.SetFrameMemory(paint.GetImage(), 0, 30, paint.GetWidth(), paint.GetHeight());
  paint.SetWidth(64);
  paint.SetHeight(64);
  paint.Clear(UNCOLORED);
  paint.DrawRectangle(0, 0, 40, 50, COLORED);
  paint.DrawLine(0, 0, 40, 50, COLORED);
  paint.DrawLine(40, 0, 0, 50, COLORED);
  epd.SetFrameMemory(paint.GetImage(), 16, 60, paint.GetWidth(), paint.GetHeight());
  paint.Clear(UNCOLORED);
  paint.DrawCircle(32, 32, 30, COLORED);
  epd.SetFrameMemory(paint.GetImage(), 120, 60, paint.GetWidth(), paint.GetHeight());
  paint.Clear(UNCOLORED);
  paint.DrawFilledRectangle(0, 0, 40, 50, COLORED);
  epd.SetFrameMemory(paint.GetImage(), 16, 130, paint.GetWidth(), paint.GetHeight());
  paint.Clear(UNCOLORED);
  paint.DrawFilledCircle(32, 32, 30, COLORED);
  epd.SetFrameMemory(paint.GetImage(), 120, 130, paint.GetWidth(), paint.GetHeight());
  epd.DisplayFrame();
  delay(2000);
  if (epd.Init(lut_partial_update) != 0) {
      Serial.println("e-Paper init failed #2");
      return false;
  }
  Serial.flush();
  /** 
   *  Note from epaper library developer:  
   *  are 2 memory areas embedded in the e-paper display
   *  and once the display is refreshed, the memory area will be auto-toggled,
   *  i.e. the next action of SetFrameMemory will set the other memory area
   *  therefore you have to set the frame memory and refresh the display twice.
   */
  epd.SetFrameMemory(IMAGE_DATA);
  epd.DisplayFrame();
  epd.SetFrameMemory(IMAGE_DATA);
  epd.DisplayFrame();
  time_start_ms = millis();
  Serial.println("e-paper setup done");
  Serial.flush();
  return true;
}

bool SetupTempSensors() {
  Serial.println("DH18B20 setup start");
  delay(10);
  ds18.begin();
  Serial.println();
  Serial.println();
  for(byte j=0; j<ds18count; j++) {
    ds18index[j] = 255; //prime for failure
    yield(); // allows brief background tasks (ESP8266 specific)
  }
  //loop the devices detected and match them with sensors we care about
  for (byte i=0; i<ds18.getDeviceCount(); i++) {
    DeviceAddress taddr;
    if(ds18.getAddress(taddr, i)) {
      ds18.setResolution(taddr, ds18Resolution); //also set desired resolution
      boolean failed = false;
      for(byte j=0; j<ds18count; j++) {
        if(oneWire.crc8(taddr, 7)==ds18addr[j][7]) { //found it
          Serial.print(i); Serial.print(" matches");Serial.println(j);
          Serial.flush();
          ds18index[j] = i; //store the lib index in the array
          break; //stop the j loop
        }
        yield(); // allows brief background tasks (ESP8266 specific)
      }
    }
    yield(); // allows brief background tasks (ESP8266 specific)
  }
  ds18.setWaitForConversion(false); //this enables asyncronous calls
  ds18.requestTemperatures(); //fire off the first request
  ds18lastreq = millis();
  ds18delay = 750 / (1 << (12 - ds18Resolution)); //delay based on resolution
  Serial.println("DH18B20 setup done");
  Serial.flush();
  return true;
}

bool SetupWiFi() {
  Serial.println("wifi setup start");
  Serial.println("Connecting to wifi: ");
  Serial.println(ssid);
  Serial.flush();

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); // delay also allows background tasks to happen
    Serial.print(".");
  }
  Serial.println(" IP address: ");
  Serial.println(WiFi.localIP());

  Serial.print(String("Connecting to "));
  Serial.println(host);

  bool flag = false;
  for (int i=0; i<5; i++){
    int retval = client.connect(host, httpsPort);
    if (retval == 1) {
       flag = true;
       break;
    } else {
      Serial.println("Connection failed. Retrying...");
      Serial.flush();
    }
    yield(); // allows brief background tasks (ESP8266 specific)
  }

  // Connection Status, 1 = Connected, 0 is not.
  Serial.println("Connection Status: " + String(client.connected()));
  Serial.flush();
  
  if (!flag){
    Serial.print("Could not connect to server: ");
    Serial.println(host);
    Serial.println("Exiting...");
    Serial.flush();
    return false;
  }

  // Data will still be pushed even certification don't match.
  if (client.verify(fingerprint, host)) {
    Serial.println("Certificate match.");
  } else {
    Serial.println("Certificate mis-match");
  }
  Serial.println("WiFi setup done");
  Serial.flush();
  return client.connected();
}

// This is the main method where data gets pushed to the Google sheet
void PostData(String tag, float value){
  if(WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected! attempting reconnect...");
    initWiFiOK = SetupWiFi();
  } else {
    Serial.println("Connection Status: " + String(client.connected()));
    Serial.flush();
    if (!client.connected()){
      Serial.println("Connecting to client again..."); 
      client.connect(host, httpsPort);
    }
    String urlFinal = url + "tag=" + tag + "&value=" + String(value);
    Serial.println("Connection Status: " + String(client.connected()));
    Serial.flush();
    bool postResult = client.printRedir(urlFinal, host, googleRedirHost);
    if(postResult) {
      timeLastPost = millis();
    }
    Serial.println("Connection Status: " + String(client.connected()));
    Serial.flush();
  }
}

bool UpdateEpaperTime() {
  time_now_s = (millis() - time_start_ms) / 1000;
  char time_string[] = {'0', '0', ':', '0', '0', '\0'};
  time_string[0] = time_now_s / 60 / 10 + '0';
  time_string[1] = time_now_s / 60 % 10 + '0';
  time_string[3] = time_now_s % 60 / 10 + '0';
  time_string[4] = time_now_s % 60 % 10 + '0';
  paint.SetWidth(32);
  paint.SetHeight(96);
  paint.SetRotate(ROTATE_270);
  paint.Clear(UNCOLORED);
  paint.DrawStringAt(0, 4, time_string, &Font24, COLORED);
  epd.SetFrameMemory(paint.GetImage(), 72, 72, paint.GetWidth(), paint.GetHeight()); //80,72
  epd.DisplayFrame();
  delay(500);
  return true;
}

bool UpdateEpaperTemps() {
  char outputString[] = {' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'C', ' '};
  String thisString = (String)tempsC[i];
  int maxChar = 7; // thisString.length();
  int minChar = 0; // string start index
  if(!isDigit(thisString[0])) { // is char a symbol?
    outputString[3] = thisString[0]; // add symbol from string
    minChar++; // increment start index
  } else {
    outputString[3] = ' '; // add space for padding
  }
  int outputIndex = 4;
  for(int j=minChar; j<maxChar; j++) {
    outputString[outputIndex] = thisString[j];
    outputIndex++;
    yield(); // allows brief background tasks (ESP8266 specific)
  }
  outputString[0] = 'T';
  outputString[1] = '1';
  if(i == 0) {
    outputString[1] = '1';
  } else {
    outputString[1] = '2';
  }
  outputString[9] = 'C';
  paint.SetWidth(32); //32
  paint.SetHeight(184); //96
  paint.SetRotate(ROTATE_270);
  paint.Clear(UNCOLORED);
  paint.DrawStringAt(0, 4, outputString, &Font24, COLORED); //0,4
  int y = 104;
  int x = 8;
  if(i == 1) {
    y = y + 32;
  }
  epd.SetFrameMemory(paint.GetImage(), y, x, paint.GetWidth(), paint.GetHeight()); //80,72
  epd.DisplayFrame();
  delay(500);
  return true;
}

void loop() {
  if((millis() - ds18lastreq) >= ds18delay) {
    bool updateTimeOK = UpdateEpaperTime();
    for(byte i=0; i<ds18count; i++) {
      tempsC[i] = ds18.getTempCByIndex(ds18index[i]);
      tempsF[i] = ds18.getTempFByIndex(ds18index[i]);
      Serial.print("Sensor: "); Serial.print(i);
      Serial.print(" TempC: "); Serial.print(tempsC[i]);
      Serial.print(" TempF: "); Serial.print(tempsF[i]);
      Serial.println();
      Serial.flush();
      if(timeLastPost < (millis() - dataPostDelay))  {
        if(tempsC[i] > (-100)) {
          PostData("Temp", tempsC[i]);
        }
      }
    }
    bool updateTempsOK = UpdateEpaperTemps();
    Serial.flush();
    ds18.requestTemperatures(); 
    ds18lastreq = millis();
  }
}

