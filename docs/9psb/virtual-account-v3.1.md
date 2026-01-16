## API DOCUMENTATION

## VIRTUAL ACCOUNT SERVICE

Change Management

Developer

Olutayo Adelodun

IT Project Manager

Oluwakemi Akinola

Support

Christopher Osu / Abiodun Olawole

## OVERVIEW
This document describes endpoints for Virtual Account Service offered by the bank. Services are:
1. Authentication
2. Virtual account creation.
3. Reallocate virtual account.
4. Deactivate virtual account.
5. Reactivate virtual account.
6. Confirm virtual account payment.
7. Refund virtual account payment.
8. Notification.

## AUTHENTICATION AND AUTHORIZATION
DESCRIPTION: All APIs require a Bearer token for authorization. Client is provided with a public key
and private key for authentication and these credentials are used to generate an Authorization
Bearer token with the endpoint below. Generated token must be passed in header of all other API
requests.
URL: POST https://baastest.9psb.com.ng/iva-api/v1/merchant/virtualaccount/authenticate

REQUEST BODY:

Field
Description
Data Type
Mandatory
publickey
Client public key
String
Y
privatekey
Client private key
String
Y

RESPONSE:

Field
Description
Data Type
status
Response status
String
code
Response code
String
message
Response message
String
access_token
Authorization Bearer token
String
expires_in
Token expiry time in seconds
Int

** SAMPLE REQUEST AND RESPONSE**

 Request
{
"publickey": "",
"privatekey": ""
}
Success response
{
"access_token":
"eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJuYW1laWQiOiIxOTVBMTY0NkQzMjc0QTZEQkVCMENEQzJ
DMTBDREU2QSIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2
xhaW1zL2hhc2giOiJjNjc4Zjc0MWM2NjU2YmM4NmUwMDk0OGE0ZGI1ZTRkYTFiZWUxM2RiYjNjMjEzZj
kwZTU4YjE5NWI0YTAwZDE3NGU2NjA1NTc0OGRlYTcyMjg0YTEyMTAzYjRkZjVkZmRmNjQwMDdhNjhiY
zYwYjBhMWQ5M2U4NTg4YzQ5NWIyYyIsInJvbGUiOiJ0cTJpd3piUWUxM1NDRi9rVDBNQjV5cnU1NVp
MOEZacnFUYkppM2JsK2EyNnFwT283MVpwNSt1VjAxZmxBVUpxUmpTVVYxSDJTb1BVazNld3h1UXY3Yl
FCbkg2bjRCbGloUittNCtIR2ZvejBzUjFicVdUZ1lqdzQ4WjJpSHRnTkNhUWxQMzZybGhKUHdETVJSYnlPej
A2RzV1TzdOLzhyYzJxWnp5bWJJYTkrSTd6K3JRclJpY1hpQjJaSmJDL1FhcVlCZGtzRXlPMnN1cG5qc1hjNVc
yb3k3bmdNcUFjeXNaQjd6c3NFdnFsK0tvWStWNElhekx6MDdyN2E1Y25MelhvYjZaa2hmUkVJTG1sTnlP
dkJaV2xiVUpta0lLQU5GSTNZNU9RdU80Z3dSRVg3Z1h2K2lTTEk1S0ViOWxKWVpmRGN6aTRMem9qUn
ZJdVpTNVNFcUJ4QXlNYlV1dUxhSXZlcDEyNEpSQnl1bzlGNUJWeW5CVWIwZ3Z6QVMrUVUiLCJuYmYiOj
E2ODY0ODM4OTksImV4cCI6MTY4NjQ5MTA5OSwiaWF0IjoxNjg2NDgzODk5LCJpc3MiOiI5UFNCX1Nlcn
ZpY2VfSW50ZXJuYWwiLCJhdWQiOiI5UFNCX1NlcnZpY2VfSW50ZXJuYWwifQ.0mdBaNIoiM_RTeCMUv3
oukkpNcMGotyGa0VJzxV8EVBADsH4uvV5c11LACl2Vr6Tm83uxc3xJHxsAAkb4JdsoQ",

"expires_in": 7200,
"code": "00",
"message": "Success"
}

Failure response
{
"access_token": null,
"expires_in": 0,
"code": "S1",
"message": "Invalid Credential"
}

## VIRTUAL ACCOUNT CREATION
DESCRIPTION: Virtual account creations are of two type- STATIC and DYNAMIC. The following rules
below applied to virtual account creation:
i.
When account.type is DYNAMIC, the expiry tag is mandatory.
ii.
“hours” field takes a minimum of 1 and maximum of 24.
iii.
Amount can be omitted if amounttype is “ANY”. iv. “Amounttype” field is mandatory, and
value can be:
a. EXACT: which means customer must pay the exact amount, otherwise the transaction
will not be accepted.
b. ANY: which means customer can pay any amount, not just the amount specified in the
order tag. With ANY, amount tag can be zero.
c. HIGHEROREXACT: which means customer must pay at least the amount specified in the
order tag or higher, but not lower.
d. LOWEROREXACT: which means customer must pay at most the amount specified in the
order tag or lower, but not higher.
v.
beneficiarytocredit tag is optional. Only necessary where a direct/instant credit is required to
the ultimate beneficiary account. The account number and bank code need to be supplied. For 9PSB
account, bank code is 120001.

URL: POST https://baastest.9psb.com.ng/iva-api/v1/merchant/virtualaccount/create

 REQUEST BODY:
Field
Description
Data type
Mandatory
transaction
JSON Object of
transaction
JSON Object
Y
transaction.reference
Transaction reference
for creating virtual
account
String
Y
order
JSON Object of order
JSON Object
Y
order.amount
amount
Double
Y
order.currency
currency
String
Y
order.description
description
String

order.country
country
String
Y
order.amounttype
Amount type
String
Y
customer
JSON Object of
customer
JSON Object
Y
customer.account
## JSON
Object
of
customer’s account
JSON Object
Y
customer.account.name
Customer’s name
String
Y
customer.account.type
Virtual account’s type String
Y
beneficiarytocredit.accountnumber Ultimate beneficiary
account to credit
String
N
beneficiarytocredit.bankcode
The bank code (six
digit NIBSS bank
code)
String
N

RESPONSE BODY:

Field
Description
Data Type
code
Response code
String
message
Response message
String
transaction
JSON Object of transaction
JSON Object
transaction.reference
Transaction reference for creating
virtual account
String
order
JSON Object of order
JSON Object
order.amount
amount
Double
order.currency
currency
String
order.description
description
String
order.country
country
String
order.amounttype
Amount type
String
customer
JSON Object of customer
JSON Object
customer.account
JSON Object of customer’s
account
JSON Object
customer.account.name
Customer’s name
String
customer.account.type
Virtual account’s type
String
customer.account.expiry
## JSON
Object
of
customer’s
account expiry hours and date
JSON Object
customer.account.expiry.hours
Expiry’s hour
int
customer.account.expiry.date
Expiry’s date
Timestamp
customer.account.number
Account number
String
customer.account.bank
bank
String
beneficiarytocredit.accountnumber Ultimate beneficiary account to
credit
String
beneficiarytocredit.bankcode
The bank code (six digit NIBSS
bank code)
String

beneficiarytocredit.feeamount
Charges to be deducted from the
payment amount and credited to
partner’s account.
double

**SAMPLE REQUEST AND RESPONSE**
Request

i.
Static example
{
"transaction": {
"reference": "20230606083659123456200"
},
"order": {
"amount": 100,
"currency": "NGN",
"description": "Test TRF",
"country": "NGA",
"amounttype": "EXACT"
},
"customer": {
"account": {
"name": "Ayinla Azeez",
"type": "STATIC"
}
}
}

ii.
Dynamic example
{
"code": "00",
"message": "Success",
"transaction": {
"reference": "20230606083659123456300"
},
"order": {
"amount": 100,
"currency": "NGN",
"description": "Test TRF",
"country": "NGA",
"amounttype": "EXACT"
},
"customer": {
"account": {
"name": "Bolaji Oreagba",
"type": "DYNAMIC",
"expiry": {
"hours": 1,
"date": "2023-06-11T13:47:31.7993952+01:00"
},

"number": "5030000013",
"bank": "9PSB"
}
},

"beneficiarytocredit": {
"accountumber": "1100000299",
"bankcode":"120001",
 "feeamount":5.50
}
}

Success response

i.
Static
{
"code": "00",
"message": "Success",
"transaction": {
"reference": "20230606083659123456200"
},
"order": {
"amount": 100,
"currency": "NGN",
"description": "Test TRF",
"country": "NGA",
"amounttype": "EXACT"
},
"customer": {
"account": {
"name": "Ayinla Azeez",
"type": "STATIC",
"expiry": null,
"number": "5030000116",
"bank": "9PSB"
}
}
}

ii.
Dynamic

{
"code": "00",
"message": "Success",
"transaction": {
"reference": "20230606083659123456300"
},
"order": {
"amount": 100,
"currency": "NGN",

"description": "Test TRF",
"country": "NGA",
"amounttype": "EXACT"
},
"customer": {
"account": {
"name": "Bolaji Oreagba",
"type": "DYNAMIC",
"expiry": {
"hours": 1,
"date": "2023-06-11T13:47:31.7993952+01:00"
},
"number": "5030000013",
"bank": "9PSB"
}
},

"beneficiarytocredit": {
"accountumber": "1100000299",
"bankcode":"120001",
"feeamount":5.50
}

}

Failure response

{
"code": "47",
"message": "Invalid transaction request - reference number must be unique.",
"transaction": {
"reference": "20230606083659123456300"
},
"order": {
"amount": 100,
"currency": "NGN",
"description": "Test TRF",
"country": "NGA",
"amounttype": "EXACT"
},
"customer": {
"account": {
"name": "Bolaji Oreagba",
"type": "DYNAMIC",
"expiry": {
"hours": 1,
"date": null
},
"number": null,
"bank": null
}
}

}

For invalid credential, response below:
{
"code": "S1",
"message": "Invalid Credential"
}

## REALLOCATE VIRTUAL ACCOUNT
DESCRIPTION: This service initiate reallocation of virtual account. The following points below must
be considered when reallocating virtual account:
1. the “reference” field is a new unique reference, not the reference used to create the original
virtual account to be reallocated.
2. the rest of the parameter is the same as when creating dynamic or virtual account.
3. the “number” field is mandatory and it virtual account number to be reallocated.
4. any virtual account can be reallocated.

URL: POST https://baastest.9psb.com.ng/iva-api/v1/merchant/virtualaccount/reallocate

REQUEST BODY:

Field
Description
Data type
Mandatory
transaction
JSON Object of
transaction
JSON Object
Y
transaction.reference
Transaction reference
for
creating virtual
account
String
Y
order
JSON Object of order
JSON Object
Y
order.amount
amount
Double
Y
order.currency
currency
String
Y
order.description
description
String

order.country
country
String
Y
order.amounttype
Amount type
String
Y
customer
JSON Object of
customer
JSON Object
Y
customer.account
## JSON
Object
of
customer’s account
JSON Object
Y
customer.account.name
Customer’s name
String
Y
customer.account.type
Virtual account’s type String
Y
Field
Description
Data type
Mandatory
customer.account.number
account number
String
Y

customer.account.expiry
## JSON
Object
of
customer’s account
expiry time
JSON Object
Y
customer.account.expiry.hours
Account expiry time in
hours
int
Y
beneficiarytocredit.accountnumber Ultimate beneficiary
account to credit
String
N
beneficiarytocredit.bankcode
The bank code (six
digit NIBSS bank code)
String
N

RESPONSE BODY:

Field
Description
Data Type
code
Response code
String
message
Response message
String
transaction.reference
Transaction reference for creating
virtual account
JSON Object
order
JSON Object of order
JSON Object
order.amount
amount
Double
order.currency
currency
String
order.description
description
String
order.country
country
String
order.amounttype
Amount type
String
customer
JSON Object of customer
JSON Object
customer.account
JSON Object of customer’s
account
JSON Object
customer.account.name
Customer’s name
String
customer.account.type
Virtual account’s type
String
customer.account.expiry
## JSON
Object
of
customer’s
account expiry hours and date
JSON Object
customer.account.expiry.hours
Expiry’s hour
int
customer.account.expiry.date
Expiry’s date
Timestamp
customer.account.number
Account number
String
customer.account.bank
bank
String
beneficiarytocredit.accountnumber Ultimate beneficiary account to
credit
String
beneficiarytocredit.bankcode
The bank code (six digit NIBSS
bank code)
String
beneficiarytocredit.feeamount
Charges to be deducted from the
payment amount and credited to
partner’s account.
double

**SAMPLE REQUEST AND RESPONSE**

Request
{
"transaction": {
"reference": "202306051414559123261"
},
"order": {
"amount": 1500,
"currency": "NGN",
"description": "Test TRF",
"country": "NGA",
"amounttype": "ANY"
},
"customer": {
"account": {
"name": "Olufunke Rhodalene",
"number":"5030000075",
"type": "DYNAMIC",
"expiry": {
"hours": 12
}
}
},
"beneficiarytocredit": {
"accountumber": "1100000299",
"bankcode":"120001",
"feeamount":5.50
}
}

 Success response

{
"code": "00",
"message": "Success",
"transaction": {
"reference": "202306051414559123261"
},
"order": {
"amount": 1500,
"currency": "NGN",
"description": "Test TRF",
"country": "NGA",
"amounttype": "ANY"
},
"customer": {
"account": {
"name": "Olufunke Rhodalene",
"type": "DYNAMIC",
"expiry": {
"hours": 12,

"date": "2023-06-12T00:49:00.4689189+01:00"
},
"number": "5030000075",
"bank": "9PSB"
}
},
"beneficiarytocredit": {
"accountumber": "1100000299",
"bankcode":"120001",
"feeamount":5.50

}
}

Failure response
 {
"code": "47",
"message": "Invalid transaction request - reference number must be unique.",
"transaction": {
"reference": "202306051414559123261"
},
"order": {
"amount": 1500,
"currency": "NGN",
"description": "Test TRF",
"country": "NGA",
"amounttype": "ANY"
},
"customer": {
"account": {
"name": "Olufunke Rhodalene",
"type": "DYNAMIC",
"expiry": {
"hours": 12,
"date": null
},
"number": "5030000075",
"bank": null
}
}
}

For invalid credential, response below:
{
"code": "S1",
"message": "Invalid Credential"
}

## DEACTIVATE VIRTUAL ACCOUNT
DESCRIPTION: This service deactivates existing virtual account. The following points below must be
considered when deactivating virtual account:
1. the “reference” field is mandatory can be original reference used to create or last used
reallocate the virtual account, or a new unique one, the original reference used to create the
virtual account will not be changed on the system.
2. the “number” field is mandatory and its the virtual account number to deactivate.
URL: POST https://baastest.9psb.com.ng/iva-api/v1/merchant/virtualaccount/deactivate

REQUEST BODY:

Field
Description
Data type
Mandatory
transaction
JSON Object of
transaction
JSON Object
Y
transaction.reference
Transaction reference
for creating virtual
account
String
Y
customer
JSON Object of
customer
JSON Object
Y
customer.account
## JSON
Object
of
customer’s account
JSON Object
Y
customer.account.number
account number
String
Y

RESPONSE BODY:

Field
Description
Data Type
code
Response code
String
message
Response message
String
transaction
JSON Object of transaction
JSON Object
transaction.reference
Transaction reference for creating
virtual account
String
customer
JSON Object of customer
JSON Object
customer.account
JSON Object of customer’s account
JSON Object
customer.account.name
Customer’s name
String
customer.account.type
Virtual account’s type
String
customer.account.expiry
customer’s account expiry time
String
customer.account.number
Account number
String
customer.account.bank
bank
String

**SAMPLE REQUEST AND RESPONSE**

Request
{

"transaction": {
"reference": "20230606093659123456101"
},
"customer": {
"account": {
"number": "5030000051"
}
}
}

 Success response
{
"code": "00",
"message": "Success",
"transaction": {
"reference": "20230606093659123456101"
}, "customer":
{ "account": {
"name": "9PSB Agent/OLAIDE ABASS",
"type": "STATIC",
"expiry": null,
"number": "5030000051",
"bank": "9PSB"
}
}
}
Failure response

{
"code": "S1",
"message": "Invalid Credential"
}

## REACTIVATE VIRTUAL ACCOUNT
DESCRIPTION: This service deactivates existing virtual account. The following points below must be
considered when deactivating virtual account:
1. the “reference” field is mandatory can be original reference used to create or last used
reallocate the virtual account, or a new unique one, the original reference used to create the
virtual account will not be changed on the system.
2. the “number” field is mandatory and its the virtual account number to reactivate.
3. the virtual account goes back to active with exact setting it had before deactivation.

URL: POST https://baastest.9psb.com.ng/iva-api/v1/merchant/virtualaccount/reactivate

REQUEST BODY:

Field
Description
Data type
Mandatory
transaction
JSON Object of
transaction
JSON Object
Y
transaction.reference
Transaction reference
for creating virtual
account
String
Y
customer
JSON Object of
customer
JSON Object
Y
customer.account
## JSON
Object
of
customer’s account
JSON Object
Y
customer.account.number
account number
String
Y

RESPONSE BODY:

Field
Description
Data Type
code
Response code
String
message
Response message
String
transaction
JSON Object of transaction
JSON Object
transaction.reference
Transaction reference for creating
virtual account
String
customer
JSON Object of customer
JSON Object
customer.account
JSON Object of customer’s account
JSON Object
customer.account.name
Customer’s name
String
customer.account.type
Virtual account’s type
String
customer.account.expiry
customer’s account expiry time
String
customer.account.number
Account number
String
customer.account.bank
bank
String

**SAMPLE REQUEST AND RESPONSE**

Request
{
"transaction": {
"reference": "20230606093659123456100"
},
"customer": {
"account": {
"number": "5030000051"
}
}
}

Success response
{
"code": "00",
"message": "Success",
"transaction": {
"reference": "20230606093659123456100"
},
"customer": {
"account": {
"name": "9PSB Agent/OLAIDE ABASS",
"type": "STATIC",
"expiry": null,
"number": "5030000051",
"bank": "9PSB"
}
}
}

 Failure response
{
"code": "47",
"message": "Invalid transaction request - account number to deactivate not found.",
"transaction": {
"reference": "20230606093659123456100"
},
"customer": {
"account": {
"name": null,
"type": null,
"expiry": null,
"number": "503000005177777",
"bank": null
}
}
}

## CONFIRM VIRTUAL ACCOUNT PAYMENT
DESCRIPTION: This service is used to confirm virtual account payment. The following points below
must be considered when confirming virtual account:
1. the “accountnumber” field is mandatory.
2. The “reference” field is the virtual account creation,”sessionid” field is the transaction
session id if customer provide it. One must be provided, the two can be provided, but the
two cannot be blank.
3. the “amount” field is not compulsory, but when provided transaction with that exact amount
will be returned if found.
4. the maximum of latest ten records that matches the parameter combination supplied will be
returned.

URL: POST https://baastest.9psb.com.ng/iva-api/v1/merchant/virtualaccount/confirmpayment

REQUEST BODY:

Field
Description
Data type
Mandatory
reference
Transaction reference
to confirm payment
String
Y if sessionid is N
or N if sessionid is
Y
sessionid
Transaction reference
id
String
Y if reference is N
or N if reference is
Y
amount
Transaction amount
Double
N
accountnumber
account number
String
Y

RESPONSE BODY:

Field
Description
Data Type
code
Response code
String
message
Response message
String
transactions
JSON Array of
transactions
JSON Array
transactions.transaction
JSON Object of
transaction
JSON Object
transactions.transaction.reference
Transaction reference String
transactions.transaction.sessionid
Transaction session id String
transactions.transaction.date
Date of confirming
payment
Timestamp
transactions.order
JSON Object of order
JSON Object
transactions.order.amount
amount
Double
transactions.order.currency
currency
String
transactions.order.description
description
String
transactions.customer
JSON Object of
customer
JSON Object
transactions.customer.account
## JSON
Object
of
customer’s account
JSON Object
transactions.customer.account.name
Customer’s name
String
transactions.customer.account.senderbankname
Sender bank name
String
transactions.customer.account.senderbankcode
Sender bank code
String
transactions.customer.account.senderaccountnumber Sender account
number
String
transactions.customer.account.number
Customer ccount
number
String
transactions.customer.account.bank
Sender bank
String

transactions.customer.account.sendername
Sender name
String

**SAMPLE REQUEST AND RESPONSE**

Request
 {
"reference": "20230606083659123456102",
"sessionid": "",
"amount": 120,
"accountnumber": "5030000013"
}

Success response
{
"transactions": [
{
"transaction": {
"reference": "20230606083659123456102",
"sessionid": "999169230607093526326281438501",
"date": "2023-06-07T09:35:29"
},
"customer": {
"account": {
"name": "9PSB Agent/Ajadi Taofeek",
"number": "5030000013",
"bank": "9PSB",
"senderbankcode": "120001",
"senderbankname": "9PSB",
"senderaccountnumber": "1100000024",
"sendername": "9PSBAgent"
}
},
"order": {
"amount": 120,
"currency": "NGN",
"description": "9PSBAgent/1100000024/TRF TEST NIP WITH NA/9PSB Agent-Ajadi
Tao/9PSB230607093526297062701"
},
"message": "Success",
"code": "00"
}
],
"code": "00",
"message": "Success"
}

Failure response
{
"transactions": null,
"code": "47",

"message": "Invalid transaction request - reference or sessionid is mandatory"
}

## REFUND VIRTUAL ACCOUNT PAYMENT
DESCRIPTION: This service is used to refund full or part of virtual account payment. The following
points below must be considered when using refund payment virtual account:
1. All request parameters field are mandatory.
2. The amount must less than (partial refund is supported) or equal the original payment.
3. The refund can be made only once for a payment, once a successful refund is made, even if
its lower than the original amount, no further refund is possible for that payment.
4. Refund maximum period is seven days from payment.
5. Refund Hash is SHA512 string composed as follows:

privateKey + sessionid + accountnumber + amount + DateOfSubmission

Sample for validation

Parameters: 9IWxL3OfOC4GO6JIQan4qlx9X8wBcz8YVjd1xizN_HR4gdlsrW0Mf7EUDQt5d1tC +
999169231016134100460496227401+ 5030045748 + 100.00 + 20231024

Combined: :
9IWxL3OfOC4GO6JIQan4qlx9X8wBcz8YVjd1xizN_HR4gdlsrW0Mf7EUDQt5d1tC999169231016134100
4604962274015030045748100.0020231024
Hash:
## 9AAB82A465201CCFE0C22A047DDCF41CFFE9D686C37415FF671613EDE6B2EFB023DE6BE682E36C8D2
## CCB1F613EA9DA688E6028C7C5DD98CCACC985BF0965175A

Note: Amount is in 2 decimal places and DateOfSubmission is in format yyyyMMdd.

URL: POST https://baastest.9psb.com.ng/iva-api/v1/merchant/virtualaccount/paymentrefund

REQUEST BODY:

Field
Description
Data type
Mandatory
sessionid
Transaction session id
as contained in the
payment notification
or confirm payment
payload
String
Y
hash
Request hash as
detailed in the
description section
String
Y
amount
amount to refund,
must be less than or
Double
Y

equal the original
payment amount
accountnumber
Virtual account
number
String
Y

RESPONSE BODY:

Field
Description
Data Type
code
Response code
String
message
Response message
String
transaction.reference
Transaction reference String
transaction.linkingreference
Transaction internal
reference
String
transaction.externalreference
Transaction session id
String
transaction.date
Date of confirming
payment
Timestamp
order.amount
amount
Double
order.currency
currency (NGN)
String
order.description
description
String
order.country
country (NGA)
String
customer
## JSON
Object
of
customer’s account
JSON Object
customer.account
## JSON
Object
of
customer’s account
JSON Object
customer.account.name
Sender Customer’s
name
String
customer.account.kyc
Customer KYC
String
customer.account.senderbankcode
Sender bank code
String
customer.account.senderaccountnumber
Sender account
number (merchant
account number
debited for refund)
String
customer.account.number
Customer account
number
String
customer.account.bvn
BVN (where available) String
customer.account.bank
Sender bank
String
customer.account.sendername
Sender name
String

**SAMPLE REQUEST AND RESPONSE**

Request
{

 "sessionid":"999169231016134100460496227401",
 "amount":"100.00",
 "accountnumber":"5030045748",
"hash":"9AAB82A465201CCFE0C22A047DDCF41CFFE9D686C37415FF671613EDE6B2EFB023DE6BE682E36C8D2
CCB1F613EA9DA688E6028C7C5DD98CCACC985BF0965175A"
}

Success response
{
 "transaction": {
 "reference": "999169231016134100460496227401R",
 "linkingreference": "VT2310141041158328768758172793",
 "externalreference": "999169231024134100460496221234",
 "date": "2023-10-24T11:53:25.8424917+01:00"
 },
 "order": {
 "amount": 100.0,
 "description": "VTS-REFUND-999169231016134100460496227401",
 "currency": "NGN",
 "country": "NGA"
 },
 "customer": {
 "account": {
 "number": "1100000309",
 "bank": "120001",
 "name": "RENZE HAVEMAN",
 "bvn": "22222222222",
 "senderaccountnumber": "1100015371",
 "sendername": "Merchant Name",
 "kyc": null
 }
 },
 "code": "00",
 "message": "Approved Or Completed Successfully"
}
Failure response
{
 "transaction": null,
 "order": null,
 "customer": null,
 "code": "47",
 "message": "Invalid transaction request - original payment not found"
}

{

 "transaction": null,
 "order": null,
 "customer": null,
 "code": "74",
 "message": "Invalid Message Signature"
}

## NOTIFICATION

DESCRIPTION: Partner provides the url where any inflow will be sent into their virtual account.
1. Basic authentication is supported for the notification service only.
2. The system will retry repush five times if response code 00 is not returned for the
notification, and after 5 times, system will stop.
3. Hash is required to be validated by the partner to further strengthen notification security
and message integrity. Hash is SHA512 string composed as follows (password is the
credential password provided to us for the basic authentication):

password + senderAccountNumber + SenderBankCode + virtualAccountNumber +
TransactionAmount

Sample for validation

Parameters: hdUof9b92D0WS40HnOhgtsem + 1003245245 + 000008 + 5030000013 + 76.70

Combined: hdUof9b92D0WS40HnOhgtsem1003245245000008503000001376.70

Hash:
## 8938CFEF854D1953A89CFD8F77EA4E0E8B2700D67ED949D6278EEB5735066D1EC4274F430
## F2231CD6F324BF5A2E7A43AFCBBF9A93E9F9BD778A83D28EECAE6BC
Note: TransactionAmount is in 2 decimal places, Hash will come in caps.

4. We require that our IPs be whitelisted on your environment for call security in addition to the basic
authentication and message hash.
5. Once you got our notification, clients are advised to call our confirmpayment endpoint before
applying fund to the account/customer position on their side, especially and mandatorily if our IPs
were not whitelisted. The request should be:
{
"sessionid": "20230606083659123456102",
"amount": 120,
"accountnumber": "5030000013"
}
 This will always return one record because session id unique.

EXPECTED REQUEST BODY:

Field
Description
Data Type
code
Response code
String
message
Response message
String
transaction
JSON Object of transaction
JSON Object
hash
Message signature
String
transaction.reference
Transaction reference
String
transaction.sessionid
Transaction session id
String
transaction.date
Date of confirming
payment
Timestamp
order
JSON Object of order
JSON Object
order.amount
amount
Double
order.currency
currency
String
order.description
description
String
customer
JSON Object of customer
JSON Object
customer.account
JSON Object of customer’s
account
JSON Object
customer.account.name
Customer’s name
String
customer.account.senderbankname
Sender bank name
String
customer.account.senderbankcode
Sender bank code
String
customer.account.senderaccountnumber
Sender account number
String
customer.account.number
Customer account number
String
customer.account.bank
Sender’s bank
String
customer.account.sendername
Sender’s name
String

EXPECTED RESPONSE BODY:

Field
Description
Data Type
code
Response code
String
message
Response message
String

**SAMPLE REQUEST AND RESPONSE**

Request
{
"transaction": {
"reference": "20230606083659123456102",
"sessionid": "999169230607093526326281438501",
"date": "2023-06-07T09:35:29"
},
"customer": {
"account": {
"name": "9PSB Agent/Ajadi Taofeek",
"number": "5030000013",

"bank": "9PSB",
"senderbankcode": "120001",
"senderbankname": "9PSB",
"senderaccountnumber": "1100000024",
"sendername": "Benson Malik"
}
},
"order": {
"amount": 120.0,
"currency": "NGN",
"description": "9PSBAgent/1100000024/TRF TEST NIP WITH NA/9PSB Agent-Ajadi
Tao/9PSB230607093526297062701"
},
"message": "Success",
"code": "00",
"hash": "ABD12343EF5678"
}
Response
{
"message":"Success",
"code":"00"
}

## RESPONSE CODES

Response Code
Message
Description
S1
Invalid credential
When invalidation authentication is passed
or call is not authorized due to IP issue or
method called not permitted.
00
Successful
Operation successful
47
Invalidation transaction request
The detail issue will be part of the message,
e.g. where account type is invalid, i.e.
neither STATIC not DYNAMIC
99
Request processing error
System error occurred, such transaction can
be re-tried, and if issue persist, please
escalate to the bank support.
