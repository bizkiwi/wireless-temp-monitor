// Created by Stephen Julian, 2018: https://github.com/bizkiwi/wireless-temp-monitor/google-apps-script-files
// Based on tutorials by Sujay S. Phadke, 2017: https://github.com/electronicsguy
//
// START Notes from Sujay S. Phadke:
// Read/Write to Google Sheets using REST API.
// Can be used with ESP8266 & other embedded IoT devices.
// 
// Use this file with the ESP8266 library HTTPSRedirect
// 
// doGet() and doPost() need the spreadsheet ID. Cannot use "active spreadsheet" here since
// the device can operate without the spreadsheet even being open.
// http://stackoverflow.com/questions/4024271/rest-api-best-practices-where-to-put-parameters
// http://trevorfox.com/2015/03/rest-api-with-google-apps-script

// Similar API docs:
// https://gspread.readthedocs.org/en/latest/
// https://smartsheet-platform.github.io/api-docs/#versioning-and-changes
// http://search.cpan.org/~jmcnamara/Excel-Writer-XLSX/lib/Excel/Writer/XLSX.pm

// http://forum.espruino.com/conversations/269510/
// http://stackoverflow.com/questions/34691425/difference-between-getvalue-and-getdisplayvalue-on-google-app-script
// http://ramblings.mcpher.com/Home/excelquirks/gooscript/optimize

// Things to remember with getValue() object format:
// 1. Partial dates or times-only will be replaced with a full date + time, probably in the
//    year 1989. Like this: Sat Dec 30 1899 08:09:00 GMT-0500 (EST)
// 2. Dollar ($) currency symbol will be absent if cell contains currency.
//    This may be locale-dependent.
// 3. Scientific notation will be replaced by decimal numbers like this: 0.0000055

// Script examples
// https://developers.google.com/adwords/scripts/docs/examples/spreadsheetapp
// END Notes from Sujay S. Phadke


var SS = SpreadsheetApp.openById('1OnKLZwhmaFKsCR-3pJgKYXADSuwws_gc4AhduMockMk');
//var SS = SpreadsheetApp.openById('1j5UX_r9JBG_qLsKYpLnlgqdZgXSkF1VC8L_mt7iAhgI');
//var sheet = SS.getSheetByName('sensor_data');

var summary_sheet = SS.getSheetByName('summary');
var sites_sheet = SS.getSheetByName('sites');
var devices_sheet = SS.getSheetByName('devices');
var sensors_sheet = SS.getSheetByName('sensors');
var logging_sheet = SS.getSheetByName('logging');

var str = "";

/*
function onOpen(){
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('ESP8266 Logging')
  .addItem('Clear', 'Clear')
  .addToUi();
}

function Clear(){
  sheet.deleteRows(4, sheet.getLastRow());
  SS.toast('Chart cleared', 'ESP8266 logging', 5);
}
*/

function doPost(e) {
  // START DateTime
  // Some useful docs:
  // https://developers.google.com/apps-script/reference/base/session#getScriptTimeZone()
  // https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet#getSpreadsheetTimeZone()
  // https://docs.oracle.com/javase/7/docs/api/java/text/SimpleDateFormat.html
  // https://docs.oracle.com/javase/7/docs/api/java/util/TimeZone.html
  // https://en.wikipedia.org/wiki/ISO_8601
  // https://www.iso.org/iso-8601-date-and-time-format.html
  // https://www.java-examples.com/formatting-day-week-using-simpledateformat
  //var spreadSheetTZ = SpreadsheetApp.getSpreadsheetTimeZone();
  var scriptTZ = Session.getScriptTimeZone();
  var now = new Date();
  var utc_now = Utilities.formatDate(now, "UTC", "dd/MM/yyyy' 'HH:mm:ss");
  var tz_now = Utilities.formatDate(now, scriptTZ, "dd/MM/yyyy' 'HH:mm:ss z");
  var tz_datetime = Utilities.formatDate(now, scriptTZ, "dd/MM/yyyy' 'HH:mm:ss z");
  var tz_date = Utilities.formatDate(now, scriptTZ, "dd MMMM yyyy"); // dd MMMM yyyy = "31 December 2018"
  var tz_12hrtime = Utilities.formatDate(now, scriptTZ, "hh:mm a"); // 12hr time e.g. 17:55 = "5:55 PM"
  var tz_dayofweek = Utilities.formatDate(now, scriptTZ, "EEEE"); // e.g. "Monday"
  var timezone = Utilities.formatDate(now, scriptTZ, "z");
  // END DateTime
  
  var retObj = new Object();
  retObj.opSuccess = false;
  retObj.opMessage = "ERROR! (?)";
  retObj.retval = "";
  //var writesensors = e.parameter.writesensors;
  var site_id = -1;
  var device_id = -1;
  var site_code = -1;
  var device_uuid = -1;
  var device_code = -1;
  var number_sensors = -1;
  var update_interval = -1;
  var number_devices = -1;
  var deviceObj = new Object();
  var siteObj = new Object();
  var sensorsObj = new Object();
  
  try { 
    parsedData = JSON.parse(e.postData.contents);
  } catch(f) {
    retObj.opSuccess = false;
    retObj.opMessage = "ERROR! When parsing request body: " + f.message;
    return ContentService.createTextOutput(retObj.opMessage);
  }
   
  if (parsedData !== undefined){
    // Common items first
    // data format: 0 = display value(literal), 1 = object value
    var flag = parsedData.format;
    if (flag === undefined){
      flag = 0;
    }
 
    switch (parsedData.clienttype) {
        
      case "iot":
        // Assemble devices info
        device_uuid = parsedData.device_uuid;
        var selectHeaders = ["device_uuid","site_id","device_id","device_code","number_sensors","update_interval"];
        var keyValue = device_uuid;
        var keyName = selectHeaders[0];
        deviceObj = getSingleRowData(devices_sheet, selectHeaders, keyName, keyValue); // get row data from sheet 
        site_id = deviceObj.dataObj["site_id"];
        device_id = deviceObj.dataObj["device_id"];
        device_code = deviceObj.dataObj["device_code"];
        number_sensors = deviceObj.dataObj["number_sensors"];
        update_interval = deviceObj.dataObj["update_interval"];
        
        // Assemble site info
        var selectHeaders = ["site_id","site_code","number_devices"];
        var keyValue = site_id;
        var keyName = selectHeaders[0];
        siteObj = getSingleRowData(sites_sheet, selectHeaders, keyName, keyValue); // get row data from sheet 
        number_devices = siteObj.dataObj["number_devices"];
        site_code = siteObj.dataObj["site_code"];
        
        break;

      case "browser":
        /* COMING SOON...
        site_id = parsedData.site_id;
        device_id = parsedData.site_id;
        
        // Assemble device info
        var selectHeaders = ["device_id","site_id","device_uuid","number_sensors","update_interval"];
        var keyValue = device_id;
        var keyName = selectHeaders[0];
        deviceObj = getSingleRowData(devices_sheet, selectHeaders, keyName, keyValue); // get row data from sheet 
        device_uuid = deviceObj.dataObj["device_uuid"];
        number_sensors = deviceObj.dataObj["number_sensors"];
        update_interval = deviceObj.dataObj["update_interval"];
        
        // Assemble site info
        var selectHeaders = ["site_id","site_code","number_devices"];
        var keyValue = site_id;
        var keyName = selectHeaders[0];
        siteObj = getSingleRowData(sites_sheet, selectHeaders, keyName, keyValue); // get row data from sheet 
        number_devices = siteObj.dataObj["number_devices"];
        site_code = siteObj.dataObj["site_code"];
        
        // Assemble sensors info
        var selectHeaders = ["device_id","sensor_id","code","name","sensor_type","sensor_uuid"];
        var keyValue = device_id;
        var keyName = selectHeaders[0];        
        sensorsObj = getMultipleRowsData(sensors_sheet, selectHeaders, keyName, keyValue);
        
        */
        break;
    }
    
    switch (parsedData.command) {
        
      case "requestDeviceInfo":

        //jsonObj["sensors"] = sensorsObj.dataObj;
        break;
        
      case "postSensorsData":
        
        var nextFreeRow = logging_sheet.getLastRow() + 1;
        var dataArr = parsedData.values.split(",");
        dataArr.unshift(device_code.toString());
        dataArr.unshift(site_code.toString());
        dataArr.unshift(device_id.toString());
        dataArr.unshift(site_id.toString());
        dataArr.unshift(tz_now.toString());
        dataArr.unshift(utc_now.toString());
        logging_sheet.appendRow(dataArr);
        
        var range = summary_sheet.getRange('A4');
        retObj.retval = range.setValue(utc_now.toString()).getValue();
        retObj.retval = summary_sheet.getRange('A4').getValue();
        
        if (retObj.retval == utc_now.toString()) {
          retObj.opSuccess = true;
          retObj.opMessage = "Data retrieved.";
        } else {
          retObj.opSuccess = false;
          retObj.opMessage = "ERROR! When writing sensor data into spreadsheet.";
        }
        
        var jsonObj = new Object();
        retObj.opSuccess = true;
        jsonObj["result"] = "Success!";
        jsonObj["message"] = "Data retrieved.";
        jsonObj["update_interval"] = update_interval;
        jsonObj["timezone"] = timezone;
        jsonObj["utc_datetime"] = utc_now.toString()+" UTC";        
        jsonObj["tz_datetime"] = tz_datetime.toString();
        jsonObj["tz_date"] = tz_date.toString();
        jsonObj["tz_12hrtime"] = tz_12hrtime.toString();
        jsonObj["tz_dayofweek"] = tz_dayofweek.toString();
        retObj.retval = JSON.stringify(jsonObj);   

        SpreadsheetApp.flush();
        return ContentService.createTextOutput(retObj.retval);
        break;
    }
    
  } else { // if there is no parsed data then... why are you here?
    retObj.opSuccess = false;
    retObj.opMessage = "ERROR! Request body empty or in incorrect format.";
  }
  
  if(retObj.opSuccess) {
    return ContentService.createTextOutput(retObj.retval.toString());
  } else {
    return ContentService.createTextOutput(retObj.opMessage);
  }
}


function doGet(e){
  var val = e.parameter.value;
  //var cal = e.parameter.cal;
  var read = e.parameter.read;
  var getdeviceinfo = e.parameter.getdeviceinfo;
  var getsensorsinfo = e.parameter.getsensorsinfo;
  var opSuccess = false;
  var opMessage = "";
  var utc_now = Utilities.formatDate(new Date(), "UTC", "dd/MM/yyyy' 'HH:mm:ss");
  var range = summary_sheet.getRange('A4');
  var retval = range.setValue(now.toString()).getValue();
  if (retval.toString() == now.toString()) {
    opSuccess = true;
    opMessage = "Successfully read: utc_lastupdate from spreadsheet.";
  } else {
    opSuccess = false;
    opMessage = "Error reading: utc_lastupdate from spreadsheet.";
  }
  return ContentService.createTextOutput(opMessage);
  /*
  if (cal !== undefined){
    return ContentService.createTextOutput(GetEventsOneWeek());
  }
  */
  /*
  if (read !== undefined){
    var now = Utilities.formatDate(new Date(), "UTC", "dd-MM-yyyy' 'HH:mm:ss");
    //var now = Utilities.formatDate(new Date(), "EST", "yyyy-MM-dd'T'hh:mm a'Z'").slice(11,19);
    sheet.getRange('D1').setValue(now);
    var count = (sheet.getRange('C1').getValue()) + 1;
    sheet.getRange('C1').setValue(count);
    return ContentService.createTextOutput(sheet.getRange('A1').getValue());
  }
  
  if (e.parameter.value === undefined)
    return ContentService.createTextOutput("No value passed as argument to script Url.");
    
  var range = sheet.getRange('A1');
  var retval = range.setValue(val).getValue();
  var now = Utilities.formatDate(new Date(), "UTC", "dd-MM-yyyy' 'HH:mm:ss");
  //var now = Utilities.formatDate(new Date(), "EST", "yyyy-MM-dd'T'hh:mm a'Z'").slice(11,19);
  sheet.getRange('B1').setValue(now);
  sheet.getRange('C1').setValue('0');
  
  if (retval == e.parameter.value)
    return ContentService.createTextOutput("Successfully wrote: " + e.parameter.value + "\ninto spreadsheet.");
  else
    return ContentService.createTextOutput("Unable to write into spreadsheet.\nCheck authentication and make sure the cursor is not on cell 'A1'." + retval + ' ' + e.parameter.value);
  */
  //return ContentService.createTextOutput(sheet.getRange('A1').getValue());
}

function getSingleRowData(selectSheet, selectHeaders, keyName, keyValue) {
  var numberSelectHeaders = selectHeaders.length;
  var retObj = new Object();
  retObj.opSuccess = false;
  retObj.opMessage = "ERROR! (?)";
  retObj.dataObj = null;
  retObj.selectHeaders = new Array(numberSelectHeaders);
  retObj.selectValues = new Array(numberSelectHeaders);
  //retObj.retval = "";
  var selectColumnIndexes = new Array(numberSelectHeaders);
  var sheetLastRowNumber = selectSheet.getLastRow();
  var sheetRowRange = "A3:"+sheetLastRowNumber; // sheet row 3 has the headers
  var sheetRowsValues = selectSheet.getRange(sheetRowRange).getValues();
  var numberColumns = sheetRowsValues[0].length;
  var numberRows = sheetRowsValues.length;
  var rowIndex = -1;
  var keyColumnNumber = -1;
  
  for(var hdr=0;hdr<numberSelectHeaders;hdr++) {
    for(var col=0;col<numberColumns;col++) {
      if(sheetRowsValues[0][col] == selectHeaders[hdr]) {
        selectColumnIndexes[hdr] = col;
        retObj.selectHeaders[hdr] = selectHeaders[hdr];
        if(selectHeaders[hdr] == keyName) {
          keyColumnNumber = col;
        }
        break;
      }
    }
  }
  if(keyColumnNumber >= 0) {
    for(var row=1;row<numberRows;row++) {
      if(sheetRowsValues[row][keyColumnNumber] == keyValue) {
        rowIndex = row;
        break;
      }
    }
    if(rowIndex >= 0) {
      for(var hdr=0;hdr<numberSelectHeaders;hdr++) {
        var colIndex = selectColumnIndexes[hdr];
        var myVal = sheetRowsValues[rowIndex][colIndex];
        if(isEmpty(myVal)) {
          myVal = "";
        }
        retObj.selectValues[hdr] = myVal;
      }
      retObj.dataObj = buildObj(retObj.selectHeaders, retObj.selectValues); // build retObj including return string and arrays
      retObj.opSuccess = true;
      retObj.opMessage = "SUCCESS!";
      return retObj;
    } else {
      retObj.opSuccess = false;
      retObj.opMessage = "ERROR! selectRowNumber out of bounds.";
    }
  } else {
    retObj.opSuccess = false;
    retObj.opMessage = "ERROR! keyColumnNumber out of bounds.";
  }
  return retObj;
}

function getMultipleRowsData(selectSheet, selectHeaders, keyName, keyValue) {
  var numberSelectHeaders = selectHeaders.length;
  var retObj = new Object();
  retObj.opSuccess = false;
  retObj.opMessage = "ERROR! (?)";
  retObj.dataObj = null;
  retObj.selectHeaders = new Array(numberSelectHeaders);
  retObj.selectValues = new Array();
  //retObj.retval = "";
  var selectColumnIndexes = new Array(numberSelectHeaders);
  var selectRowIndexes = new Array();
  var numberSelectRows = 0;
  var sheetLastRowNumber = selectSheet.getLastRow();
  var sheetRowRange = "A3:"+sheetLastRowNumber; // sheet row 3 has the headers
  var sheetRowsValues = selectSheet.getRange(sheetRowRange).getValues();
  var numberColumns = sheetRowsValues[0].length;
  var numberRows = sheetRowsValues.length;
  var selectRowNumber = -1;
  var keyColumnNumber = -1;
  
  for(var hdr=0;hdr<numberSelectHeaders;hdr++) {
    for(var col=0;col<numberColumns;col++) {
      if(sheetRowsValues[0][col] == selectHeaders[hdr]) {
        selectColumnIndexes[hdr] = col;
        retObj.selectHeaders[hdr] = selectHeaders[hdr];
        if(selectHeaders[hdr] == keyName) {
          keyColumnNumber = col;
        }
        break;
      }
    }
  }
  if(keyColumnNumber >= 0) {
    for(var row=1;row<numberRows;row++) {
      if(sheetRowsValues[row][keyColumnNumber] == keyValue) {
        selectRowIndexes.push(row);
        //selectRowNumber = row;
        //break;
      }
    }
    numberSelectRows = selectRowIndexes.length;
    if(numberSelectRows > 0) {
      if(numberSelectHeaders > 0) {
        var loopFlag = false;
        for(var row=0;row<numberSelectRows;row++) { // for every row index
          retObj.selectValues[row] = new Array(numberSelectHeaders);
          for(var hdr=0;hdr<numberSelectHeaders;hdr++) { // for every header name
            var rowIndex = selectRowIndexes[row];
            var colIndex = selectColumnIndexes[hdr];
            retObj.selectValues[row][hdr] = sheetRowsValues[rowIndex][colIndex];
          }
        }
        retObj.dataObj = buildNestedObj(retObj.selectHeaders, retObj.selectValues); // build retObj including return string and arrays
        retObj.opSuccess = true;
        retObj.opMessage = "SUCCESS!";
        return retObj;
      } else {
        retObj.opSuccess = false;
        retObj.opMessage = "ERROR! numberSelectHeaders out of bounds.";
      }
    } else {
      retObj.opSuccess = false;
      retObj.opMessage = "ERROR! numberSelectRows out of bounds.";
    }
  } else {
    retObj.opSuccess = false;
    retObj.opMessage = "ERROR! keyColumnNumber out of bounds.";
  }
  return retObj;
}

function isEmpty(myData) {
  return typeof(myData) == 'string' && myData == '';
}

function buildNestedObj(selectHeaders, selectValues) {
  // build return string
  //JSON.stringify(value)
  var numberSelectHeaders = selectHeaders.length;
  var numberSelectRows = selectValues.length;
  
  var retObj = new Object();
  if(numberSelectHeaders > 0) {
    for(var row=0;row<numberSelectRows;row++) { // for every row
      retObj[row] = new Array(numberSelectHeaders);
      //selectValues[row].length
      for(var hdr=0;hdr<numberSelectHeaders;hdr++) { // for every header
        var myKey = selectHeaders[hdr];
        var myValue = selectValues[row][hdr];
        if(isEmpty(myValue)) {
          myVal = "";
        }
        retObj[row][myKey] = myValue;
      }
    }
  }
  return retObj;
}

function buildObj(selectHeaders, selectValues) {
  // build return string
  // JSON.stringify(value)
  var numberSelectHeaders = selectHeaders.length;
  var retObj = new Object();
  if(numberSelectHeaders > 0) {
    for(var hdr=0;hdr<numberSelectHeaders;hdr++) {
      var myKey = selectHeaders[hdr];
      var myValue = selectValues[hdr];
      retObj[myKey] = myValue;
    }
  }
  return retObj;
}

function getValueFromKey(myObj, myName) {
  var iMax = myObj.selectColumns.length;
  for(var i=0;i<iMax;i++) {
    if(myObj.selectColumns[i] == myName) {
      return myObj.selectValues[i];
    }
  }
  return false;
}
