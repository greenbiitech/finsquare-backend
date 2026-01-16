## API DOCUMENTATION

WALLET AS A SERVICE.
(Version 3)

Change Management
 Developer
Ireoluwa Olapade, Chibueze Nwajiobi
 IT Project Manager
 Glory Umeham
 Support
 Irivgboje Anne-joy
 Version
 3.0

Change
-
Introduction of Wallet to Other Bank Response Codes under overview
section.
-
Explanation of use case for TSQ endpoint under Transaction Status Query
section.
-
QR code integration guide
-
Account Upgrade Webhook Notification

This document has been classified as “Confidential” and has been issued strictly for internal business purposes of the 9 Payment
Service Bank (9PSB). Dissemination thereof outside of the 9PSB is prohibited unless prior written approval is obtained from the
policy owner.

 2 | P a g e
## 1. OVERVIEW
This document describes APIs for available Wallet Operations and provides comprehensive guide to seamless
integration to the APIs.
All API return a generic JSON response of {message, status, statusCode, data}.

## DEBIT WALLET/CREDIT WALLET RESPONSE CODES AND CORRESPONDING MESASAGES

Response Codes
## S/N
Response Code
Description
1
00
Success

2

99

Generic Failure, Transaction processing failure

3

97

System error failure
4
96
Invalid Operation – mostly when invalid parameters are supplied
for an operation
5
95
Invalid Fee Configuration – when a wallet credit/debit does not
have the right fee configuration
6
94
Invalid Wallet Operation – When trying to open a wallet for
a customer who already exists or whose account was
already closed.
7
93
Inactive Wallet Operation – when performing operation on an
inactive wallet
8
51
Insufficient fund
9
42
Duplicate transaction reference. Check status for previous call

## WALLET TO OTHER BANKS RESPONSE CODES AND CORRESPONDING MESASAGES

Response Code
Message
Description
Action / Treatment
00
Approved Or
Completed
Successfully
Transaction has been approved or
completed
No action, transaction succeeded
03
Invalid Sender
Invalid sender
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
05
Do Not Honor
Do not honor
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
06
Dormant Account
Dormant account
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
07
Invalid Account
Invalid account
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
08
Account Name Mismatch
Account name mismatch
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
09
Request Processing In
Progress
Request processing in progress
TSQ required which can return 00,
if not reversal can only happen by
settlement after reconciliation.
12
Invalid Transaction
Invalid transaction
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
13
Invalid Amount
Invalid amount
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.

 4 | P a g e
15
Invalid Session Or Record
ID
Invalid session or record id
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
16
Unknown Bank Code
Unknown bank code
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.

Response Code
Message
Description
Action / Treatment
17
Invalid Channel
Invalid channel
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
25
Unable To Locate
Record
Records not found
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
26
Duplicate Record
Duplicate transaction reference used
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
34
Suspected Fraud
Suspected fraud
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
47
Invalid transaction request
Validation error and the exact error will
be part of the
messages
No Action. Transaction failed,
debit will not impact source
account
51
No Sufficient Funds
Insufficient funds
No action, transaction failed, and
debit will not impact
source account
57
Transaction Not
Permitted To Sender
Transaction is not permitted
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
58
Transaction Not
Permitted On Channel
Transaction is not permitted on the
channel
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.

61
Transfer Limit Exceeded
Transfer limit has been exceeded
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
63
Security Violation
Security violation
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
65
Exceeds Withdrawal
Frequency
Total number of withdrawal exceeded
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
68
Response Received Too Late Response was received too late
No action, transaction failed, and
debit will not impact source
account and where

debit happened, reversal will
happen.
91
Beneficiary Bank Not
Available
Beneficiary bank not available
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
92
Routing Error
Routing error
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
94
Duplicate Transaction
Duplicate transaction
No action, transaction failed, and
debit will not impact source
account and where debit
happened, reversal will happen.
96
System Malfunction
System malfunction
TSQ required which can return 00,
if not reversal can only happen by
settlement after reconciliation.
97
Time Out Waiting For
Response
Time out
TSQ required which can return 00,
if not reversal can only happen by
settlement after reconciliation.
99
Request processing error
Unexpected error encountered
during processing
TSQ required which can return 00,
if not reversal can only happen by
settlement after reconciliation.
98
Failed No Response
Failed with no response
TSQ required which can return 00,
if not reversal can only happen by
settlement after reconciliation.
74
Invalid Message Signature
Invalid message signature
No Action. Transaction failed,
debit will not impact source
account

 6 | P a g e

Response Messages – In addition to response code, a response message is included in the payload. The
below are the present messages

## S/N
Message
1
Account Opening successful
2
Invalid merchant. Kindly contact 9PSB Support
3
An error occurred
4

Transaction history

5
Merchant fee configuration unavailable. Please contact admin
6
Unauthorized operation. Please contact admin
7
Unauthorized Access to resource. Kindly contact the administrator
8
Wallet Status Enquiry Successful
9
Wallet Status Change Successful
10
A Wallet Already Exists For This User
11
The requested action is not valid
12
The requested action is not valid on the supplied wallet
13
Wallet has insufficient funds to cover the transaction

14
Kindly Supply Valid Phone Number, BVN or NIN
15
BVN Validation Not Successful
16
Kindly Supply Valid Phone Number

Status
## S/N
Status
1
## FAILED
2
## SUCCESS
3
## PENDING

## 2. AUTHENTICATION
The client is provided with required credentials to generate authorization bearer tokens which is
required as authorization for every other API
Request URL:
http://102.216.128.75:9090/waas/api/v1/authenticate

Request Body
 Field
 Description
 Mandatory/Optional
 Type
username
Channel username
Mandatory
String
password
Channel password
Mandatory
String
 clientId
Service client ID
Mandatory
String
 clientSecret
Service secret
Mandatory
String

Response Body
 Field
 Description
 Type
accessToken
Bearer Authentication Access Token
String
message
Status message
String
refreshToken
Bearer Authentication refresh token
String
 expiresIn
Expiration time
String
refreshExpiresIn
Refresh Expiration
String

## 3. WALLET OPENING

Description: Creates new customer wallet account
Request URL: http:// 102.216.128.75:9090/waas/api/v1/open_wallet

**REQUEST BODY**
Request Parameters
Description
Mandatory
/Optional
Type
Max
Length
transactionTrackingRef A unique number assigned to each
individual account for tracking purposes
Mandatory
String
NA
lastName
Customer Last Name
Mandatory
String
NA
otherNames
Other names of the customer
Mandatory
String
NA
accountName
Specifies how account will be named
Optional
String
NA
 phoneNo
 Customer’s phone Number
Mandatory
String
NA

gender
 Customer’s Gender (0: Male, 1:
Female)
Mandatory
Integer
NA
 placeOfBirth
Place of Birth
Optional
String
NA

 Mandatory
 String
10
dateOfBirth
Date of Birth. Format “dd/MM/yyyy”

 address
Address of Customer
Mandatory
String
100
nationalIdentityNo
 Customer National Identity Number
Optional where
BVN is provided
String
11
ninUserId
Unique ID for user NIN.
Can be retrieved from the NIMC app or
by dialling *346*2*Your NIN# on any
other mobile phone.
Mandatory
where NIN is
provided
String
11
 nextOfKinPhoneNo
Next of kin Phone No
Optional
String
11
 nextOfKinName
Next of Kin Name
Optional
String
NA
 referralPhoneNo
 Referral Phone Number
Optional
String
11
 referralName
Referral Name
Optional
String
NA
otherAccountInformation
Source
Other information
Optional
String
## N/A
 email
Email Address
Optional
String
NA

10

customerImage
 Customer Base 64 Image
String
Optional
Base 64
String
NA
customerSignature
Customer Base 64
Signature string
Optional
Base 64
String
NA
 bvn
 The BVN of the customer
Optional
if NIN and
NIN UserID is
provided
String
11

**RESPONSE BODY**
 Response Parameters
 Description
message
 Response message
 status
 Success or Failed (Primary field to check to affirm a successful or failed
account creation)
 data
 New Account details JSON object (Check Postman link)

## 4. WALLET ENQUIRY
Description: Fetch details of a customer’s wallet
Request URL: http:// 102.216.128.75:9090/waas/api/v1/wallet_enquiry

**REQUEST BODY**
 Field
Description
Mandatory/Optional
Type
Max Length
accountNo
Customer’s
account Number
Mandatory
String
NA

Response Parameters

Description
 message
Response message

 status

Success or Failed (Primary field to check to affirm a successful or failed
account creation)
data

A JSON object containing customer account information including account
balance.
Please check the POSTMAN collections link.

## 5. SINGLE WALLET DEBIT/CREDIT

Description: API to move funds between a Wallet Account and Client’s Float account. For Debit,
Wallet account is Debited of transaction amount and Client’s Float account is Credited. For Credit,
Client’s Float account is debited, and Wallet account is credited.

Request URLS:
Debit - http://102.216.128.75:9090/waas/api/v1/debit/transfer
Credit – http://102.216.128.75:9090/waas/api/v1/credit/transfer
**REQUEST BODY**

 Fields
 Description
 Mandatory
/Optional
 Type
Max
Length
 accountNo
The wallet to be debited
Mandatory
String
10
 totalAmount
Amount to be debited/Credited
Mandatory
String
NA
 transactionId
Unique Transaction Reference
Mandatory
String
25
 narration
 The narration for the transaction
(channel/WAAS/DR/walletNo/
reference)
Mandatory
String
100
 merchant
 Object indicating if client is charging an
extra fee for the transaction. Comprises
of merchantFeeAmount,
MerchantFeeAccount and isFee.
Mandatory
## JSON
NA
 merchantFeeAmount
 Extra fee being charged by Client
Optional if isFee is
False
String
NA

 merchantFeeAccount
 Client Operational (Fee) account.
Optional if isFee is
False
String
10
isFee
Indicates if Client is charging an extra fee
for the transaction.
Mandatory
Boolean NA

 Response Parameters

 Description
 message

 Response message
 status

 Success or Failed (Primary field to check to affirm a
successful or failed account creation)
 data

 A JSON object containing customer account
information including account balance.
Please check the POSTMAN collections link.

6a. UPGRADE ACCOUNT

Description: Upgrades wallet account from lower to higher tier
Request URL: http://102.216.128.75:9090/waas/api/v1/wallet_upgrade

**REQUEST BODY**
Field
Description
Mandatory/Optional
Type
accountNumber
Customer wallet account number
Mandatory
String
bvn
Bank Verification Number of Customer
Mandatory
String
nin
Customer National Identification Number
Mandatory
String
accountName
Customer Account Name
Mandatory
String
phoneNumber
Phone Number (08011111111)
Mandatory
String

tier
New tier for wallet account (2 OR 3)
Mandatory
String
email
Customer email
Mandatory
String
userPhoto
Customer photo, Base64 image string not more
than 100000 characters
Mandatory
String

 14 | P a g e

idType
This should be 1,2,
3 or 4
1 – National
ID(NIN)
2 – Driver’s License
3 – Voter’s Card
4 – International
Passport

NIN is Recommended
Mandatory
String
idNumber
ID Number (NIN is recommended)
Mandatory.
String
idIssueDate
ID Issue date, format “yyyy- MM-dd” Mandatory
String
idExpiryDate
ID Expiry date, format “yyyy- MM-
dd”
Mandatory, Optional
for NIN
String
idCardFront
Front Image of the ID. Base 64 image
string not more than 100,000
characters
Mandatory
String
idCardBack
Back Image of the ID. Base 64 image
string not more than 100,000
characters
Optional
String
houseNumber
Customer House
Number
Mandatory
String
streetName
Street Name
Mandatory
String
state
State
Mandatory
String
city
City
Mandatory
String
localGovernment
Local Government
Mandatory
String
pep
If customer is a politically exposed
person. This should be YES or NO
Mandatory
String

customerSignature
Customer’s signature. This
should be a Base64 image
string - not more than 50000
characters
Mandatory
String

 15 | P a g e
utilityBill
Utility bill. This
should be a Base64 image
string - not more than 50000
characters
Mandatory
String
nearestLandmark
Nearest Landmark
Mandatory
String
placeOfBirth
Place of Birth
Optional
String
proofOfAddressVerification
This should be a Base64 image
string - not more than 50000
characters
Optional for Tier 2.
Mandatory for Tier 3
String

**RESPONSE BODY**
Field
Description
Type
message
Response message for request
String
data
A JSON Object containing
message and status
## JSON
status
Status of request (SUCCESS OR
FAILED)
String

6b. UPGRADE ACCOUNT WITH IMAGE FILE PAYLOAD

Description: Upgrades wallet account from lower to higher tier, using Content-Type:
multipart/form-data.
Request URL: http://102.216.128.75:9090/waas/api/v1/wallet_upgrade_file_upload REQUEST
## BODY
Field
Description
Mandatory/Optional
Type
accountNumber
Customer wallet
account number
Mandatory
String
bvn
Bank Verification
Number of
Customer
Mandatory
String

 16 | P a g e
nin
Customer’s National
Identification number
Mandatory
String
accountName
Customer
Account Name
Mandatory
String
phoneNumber
Phone Number
(08011111111)
Mandatory
String
tier
New tier for wallet
account (2 OR 3)
Mandatory
String

email
Customer email
Mandatory
String
userPhoto
Customer photo. This
should be an image
file with
either .JPG, .PNG
or .JPEG format.
Image size should not
exceed 150kb.
Mandatory
Multipart file
idType
This should be 1,2,
3, or 4
1 – National
ID(NIN)
2 – Driver’s License
3 – Voter’s Card
4 – International
Passport

1 (NIN) is
recommended
Mandatory
String
idNumber
ID Number (NIN is
recommended)
Mandatory
String
idIssueDate
ID Issue date,
format “yyyy- MM-dd”
Mandatory
String

 17 | P a g e
idExpiryDate
ID Expiry date,
format “yyyy- MM-dd”
Optional for IdType
without expiry date.
String

idCardFront
Front Image of the ID.
This should be an
image file with
either .JPG, .PNG
or .JPEG format.
Image size should not
exceed 150kb
Mandatory
Multipart file
idCardBack
Back Image of the ID.
This should be an
image file with
either .JPG, .PNG
or .JPEG format.
Image size should not
exceed 150kb
Optional
Multipart file
houseNumber
Customer House
Number
Mandatory
String
streetName
Street Name
Mandatory
String
state
State
Mandatory
String
city
City
Mandatory
String
localGovernment
Local
Government
Mandatory
String
pep
If customer is a
politically exposed
person. This should
be YES or NO
Mandatory
String
customerSignature
Customer’s
signature. This
should be an image
file with
either .JPG, .PNG
or .JPEG format.
Image size should
not exceed 150kb
Mandatory
Multipart file

 18 | P a g e
utilityBill
Utility bill. This
should be an image
file with
either .JPG, .PNG
or .JPEG format.
Image size should
not exceed 150kb
Mandatory
Multipart file
nearestLandmark
Nearest Landmark
Mandatory
String
placeOfBirth
Place of Birth
Optional
String
proofOfAddressVerification
This should be an
image file with
either .JPG, .PNG
or .JPEG format.
Image size should not
exceed 150kb
Optional but Mandatory
for Tier 3 upgrade
Multipart file

**RESPONSE BODY**
Field
Description
Type
message
Response message for request
String
data
A JSON Object containing
message and status
## JSON
status
Status of request (SUCCESS OR
FAILED)
String

 19 | P a g e
## 6. UPGRADE STATUS

Description: Upon completion of an account upgrade (Approved or Declined), a webhook is sent
to client configured Webhook URL with details of an account upgrade. This API can be called
upon receiving the webhook to confirm the status or at intervals to get the latest status.

Request URL: http://102.216.128.75:9090/waas/api/v1/upgrade_status

**REQUEST BODY**
Field
Description
Mandatory/Optional
Type
accountNumber
Customer wallet
account number
Mandatory
String

**RESPONSE BODY**
Field
Description
Type
message
Response message for request
String
data
A JSON Object containing
message and status
## JSON
status
Status of request (SUCCESS OR
FAILED)
String

## 7. WALLET TRANSACTION HISTORY

Description: Fetches a customer’s transaction history
Request URL: http://102.216.128.75:9090/waas/api/v1/wallet_transactions

**REQUEST BODY**
Field
Description
Mandatory/Optional
Type
accountNumber
Customer’s wallet
account number
Mandatory
String
fromDate
Start of date range
Mandatory
String

 20 | P a g e
toDate
End of date range
Mandatory
String
numberOfItems
Number of
transactions to display
Mandatory
String

**RESPONSE BODY**
Field
Description
Type
message
Response message for request
String
status
Response status for request. (SUCCESS
OR FAILED)
String
data
JSON Object containing a list of customers transactions.

See POSTMAN collection for more details
JSON Object

## 8. TRANSACTION STATUS
Description: Verifies the status of a transaction. This can be used for DEBIT WALLET, CREDIT
WALLET and WALLET TO OTHER BANKS. It is recommended that TSQ is done for other back
transactions in line with the response in section 1.

Request URL: http://102.216.128.75:9090/waas/api/v1/wallet_requery

**REQUEST BODY**
Field
Description
Mandatory/Optional
Type
transactionId
Id of transaction
Mandatory
String
amount
Transaction amount
Mandatory
Integer
transactionType
Type of transaction
Mandatory
String

 21 | P a g e
transactionDate
Date of transaction
Mandatory
String
accountNo
Customer’s account
number
Mandatory
String

**RESPONSE BODY**
Field
Description
Type
message
Response message for request
String
status
Response status for request
String
data
JSON Object containing
transaction status and
reference
JSON Object

## 9. WEBHOOKS
Description: Client Provides a webhook URL to receive notifications for events such as Inflow
Credit and Account upgrade. Depending on the Event type, A query Param is appended to the
URL for merchant to identify the event type and handle accordingly.

Currently Supported Events are transfer and account-upgrade

i.e. Given Webhook URL: https://api.merchant.com.ng/9psb/webhook
Inflow Credit/Transfer Notification - https://api.merchant.com.ng/9psb/webhook?event=transfer
Account Upgrade - https://api.merchant.com.ng/9psb/webhook?event=account-upgrade

To acknowledge a webhook, Clients are expected to respond with the below response body else
notification will be treated as Unsuccessful and will be retried by our system a maximum of 5
times.

{
 "success": true,
 "code": "00",
 "status": "SUCCESS",
 "message": "Acknowledged"
}

 22 | P a g e
9a. INFLOW/TRANSFER NOTIFICATION WEBHOOK
When a wallet account receives an inflow e.g. Transfer from another Bank, An Inflow Notification
Payload is sent to provided webhook URL. Payload exists in SHORT and LONG format of which
client can opt for a preferred format.

NOTE: This webhook should be protected only using BASIC AUTH i.e. username and
password.

Where Client provides username as ‘username’, password as ‘password’

Authorization Header for every request will be:

‘Authorization’: ‘Basic Base64(username:password)’

Clients are advised to call the notification_requery API to confirm every inflow
notification. In a situation where a notification has been previously acknowledged, it’s
advised to still respond with a success response.

URL: POST {{client-webhook-url}}?event=transfer

REQUEST BODY (Short format)
Field
Description
Mandatory/Optional
Type
merchant
Name of partner
Mandatory
String
amount
Transaction Amount
Mandatory
String
sourceaccount
Account number of
sender
Mandatory
String
sourcebank
Bank code of destination
account
Mandatory
String
sendername
Sender name
Mandatory
String
nipsessionid
Unique session id
Mandatory
String
accountnumbser
Destination account
number
Mandatory
String

 23 | P a g e
narration
Description of
transaction
Mandatory
String
transactionref
Unique string for
transaction
Mandatory
String
orderref
Unique Notification
reference
Mandatory
String
code
Success code
Mandatory
String
message
Success
Mandatory
String

REQUEST BODY (Long Format)
Field
Description
Mandatory/Optional
Type
transaction
JSON object
containing the
external reference
Mandatory
JSON Object, sample paylaod
{ String
externalreference
}
order
JSON Object of order
details
Mandatory
JSON Object, sample payload
{ String
amount,
String status,
String currency,
String amountpaid
}

customer
JSON Object of
customer account
details
Mandatory
JSON Object, sample payload
{
customer
{
account {
String number, String
bank, String
senderbankname,
String type,
String

senderaccountnumber,
String sendername
}
}
}
sourceaccount
Debit account number Mandatory
String

 24 | P a g e
amount
Transaction amount
Mandatory
String
merchant
Merchant short
code, same as
merchant’s name
Mandatory
String
sourcebank
Debit account’s bank
name
Mandatory
String
accountnumber
Credit account
number
Mandatory
String
narration
Description of
transaction
Mandatory
String
orderref
Credit account
number
Mandatory
String
code
Success code
Mandatory
String
message
Success
Mandatory
String

**RESPONSE BODY**
Field
Description
Type
message
Response message for
request (received successfully)
String
status
Status response (success)
String
success
true or false
Boolean
code
Status Code (00 for success)
String
transactionRef
Unique string for transaction
String

9b. ACCOUNT UPGRADE NOTIFICATION WEBHOOK
Description: As stated in Item 6 (Upgrade Status), webhook notifications are also sent for account upgrades.

URL: POST {{client-webhook-url}}?event=account-upgrade

## REQUEST PAYLOAD

 25 | P a g e
Field
Description
Mandatory/Optional
Type
accountNumber
Account Number for Upgrade Mandatory
String
status
Status of Upgrade (Approved,
Declined)
Mandatory
String
message
Approval Message or Decline
Reason
Mandatory
String

## 10. WALLET TO OTHER BANK

Description: Transfer from customer wallet to other bank
Request URL: http://102.216.128.75:9090/waas/api/v1/wallet_other_banks

**REQUEST BODY**
Field
Description
Mandatory/Optional
Type
transaction
JSON object containing
the transaction reference
Mandatory
JSON Object
order
JSON object of order details
Mandatory
JSON Object
customer
JSON Object of
customer account
details
Mandatory
JSON Object
merchant
## JSON
Object
of
merchant details
Mandatory
JSON Object
transactionType
Default value:
## OTHER_BANKS
Mandatory
String
narration
Transaction narration.
Mandatory
String

 26 | P a g e

**RESPONSE BODY**
Field
Description
Type
message
Response message for request
String
status
Response status for request
String
data
JSON Object request
JSON Object
responseCode
Response code for request’s
result
String

## 11. OTHER BANK ACCOUNT ENQUIRY

Description: Verify Account Details of other bank’s account.
Request URL: http://102.216.128.75:9090/waas/api/v1/other_banks_enquiry

**REQUEST BODY**
Field
Description
Mandatory/Optional
Type
customer
JSON object account
information
Mandatory
JSON Object

**RESPONSE BODY**
Field
Description
Type
message
Response message for request
String
status
Response status for request
String
data
JSON Object of request
JSON Object

 27 | P a g e
## 12. WALLET STATUS

Description: Fetch status of customer wallet.
Request URL: http://102.216.128.75:9090/waas/api/v1/wallet_status

**REQUEST BODY**
Field
Description
Mandatory/Optional
Type
accountNo
Customer’s wallet account number
Mandatory
String

**RESPONSE BODY**
Field
Description
Type
message
message code for response
String
status
Response status
String
data
JSON Object containing wallet status
JSON Object

## 13. CHANGE WALLET STATUS

Description: Updates status of customer wallet.
Request URL: http://102.216.128.75:9090/waas/api/v1/change_wallet_status

**REQUEST BODY**
Field
Description
Mandatory/Optional Type
accountNumber
Customer’s wallet account number
Mandatory
String
accountStatus
New status value for customer’s account
(ACTIVE or SUSPENDED)
Mandatory
String

**RESPONSE BODY**
Field
Description
Type
message
Response message for request
String
status
Response status for request
String
responseCode
Response cod for request
String
data
JSON Object containing new wallet status
JSON Object

 28 | P a g e
## 14. GET BANKS

Description: Fetch list of all Banks.
Request URL: GET http://102.216.128.75:9090/waas/api/v1/get_banks

**RESPONSE BODY**
Field
Description
Type
message
Code depicting message response
String
data
JSON Object containing list of banks

See POSTMAN collection for more details
JSON Object
status
Response status of request
String

## 15. NOTIFICATION REQUERY

Description: API to confirm an inflow credit/transfer webhook notification.
Request URL: http://102.216.128.75:9090/waas/api/v1/notification_requery

**REQUEST BODY**
Field
Description
Mandatory/Optional
Type
sessionID
SessionId of transaction from Notification
Payload
NB: For Long Format, equivalent value is
externalReference
Mandatory
String
accountNumber
Customer’s wallet account number
Mandatory
String

 29 | P a g e
**RESPONSE BODY**
Field
Description
Type
message
Response message for request
String
responseCode
Response code for request
String
status
Response status of request
String
data
JSON Object of notification request
JSON Object

## 16. GET WALLET BY BVN

Description: Fetch wallet information using BVN.
Request URL: http://102.216.128.75:9090/waas/api/v1/get_wallet

**REQUEST BODY**
Field
Description
Mandatory/Optional
Type
bvn
Customer’s BVN
Mandatory
String

**RESPONSE BODY**
Field
Description
Type
message
Response message
String
data
JSON Object containing wallet info

See POSTMAN collection for more details
JSON Object
status
Response status of request
String

 30 | P a g e
17. Open Corporate Account Using Base 64 String
Description: Open Corporate Account using Base64 Image String. Content-Type:
application/json. Sample payload can be found in Postman Collection.

Request URL: http://102.216.128.75:9090/waas/api/v1/open_corporate_account

**REQUEST BODY**
Field
Description
Mandatory/Opti onal Type
phoneNo
Organization phone
number (08011111111)
Mandatory
String

postalAddress
Postal address (include
nearest bus stop, city and
state)
Mandatory
String
taxIDNo
TIN of business
Mandatory
String
businessName
Name of Business
Mandatory
String
tradeName
Business Trade name
Mandatory
String
industrialSector
Industrial Sector eg
primary sector ie
Agriculture, mining or
secondary sector ie
manufacturing,
construction or tertiary
Mandatory
String

ie banking, healthcare,
education
or retail

email
Business Email
Mandatory
String
address
Company Operating
Address and state
Mandatory
String
companyRegDate
Date of Registration.
Date format should be
“yyyy-MM-dd”
Optional
String

 31 | P a g e
contactPersonFirstName
Contact person first name
Mandatory
String
contactPersonLastName
Contact person last name
Mandatory
String
businessType
Type of business
Sole_Proprietorship,
Partnership,
Limited_Liability_Com
pany, NGO, Corporations,
Cooperative,
Franchise, Non_Profit,
Social_Enterprise or
Others.
Mandatory
String
businessTypeName
Only to be included if
businessType is Others.
Optional
String
natureOfBusiness
Nature Of Business eg
manufacturing, Retail,
Finance, Hospitality,
Real estate or
Technology.
Mandatory
String
webAddress
Website of organization
Optional
String
dateIncorporated
Date of Incorporation.
Date format should be
“yyyy-MM-dd”
Mandatory
String
businessCommencemen tDate Business
Commencement
Date. Date format
should be “yyyy-
MMdd”
Mandatory
String
registrationNumber
Business Registration
Number
Mandatory
String

cacCertificate
CAC certificate image. This
should be converted to a
base64
String not more than
100,000 characters
Mandatory
String
utilityBill
Image of company
Mandatory
String

 32 | P a g e

utility bill. This should be
converted to a base64
String not more than
100,000 characters

proofOfAddressVerificati on
 Proof
of
address
verification. This should
be converted to a base64
String not more than
100,000 characters
Mandatory
String
scumlCertificate
Image of SCUML
certificate (if
applicable). This should be
converted to a base64
String not more than
100,000 characters
Optional,
Mandatory for
businesses that
fall within the
category
String
regulatoryLicenseFintech
Image of FINTECH
License (if applicable). This
should be converted to a
base64
String not more than
100,000 characters
Optional,
Mandatory for
businesses that
fall within the
category
String
accountSignatories
Payload for signatories of
the organization can be
found in the table below
Mandatory
(Optional for
Sole_Proprietorshi p)
ArrayList<Dire
ctor
Payload>
directors
Payload for directors of the
organization can be found
in the table below
Mandatory
ArrayList<Dire
ctor
Payload>
Director and Account Signatory Payload

Field
Description
Mandatory/Opti
onal
Type
lastName
Last name
Mandatory
String

 33 | P a g e
firstName
FirstName
Mandatory
String
otherNames
Other Names
Mandatory
String
address
Customer Address
Mandatory
String

gender
Customer Gender (Male
or Female)
Mandatory
String
dateOfBirth
The date format
should be “yyyy- MMdd”
Mandatory
String
phoneNo
Phone Number
Mandatory
String
placeOfBirth
Place of Birth
Optional
String
nationalIdentityNo
## NIN
Optional
String
nextOfKinName
Next of Kin Name
Mandatory
String
nextOfKinPhoneNumber
Next of Kin Phone
Number
(08033333333)
Mandatory
String
customerType
Individual
Mandatory
String
branchID
0
Mandatory
String
bankVerificationNumber
Bank Verification
Number of Customer
Mandatory
String
email
Email address
Mandatory
String
customerPassportInBytes
Customer passport
photo. This should be
converted to a base64
String not more than
100,000 characters.
Mandatory
String
accountOfficerCode
Account Officer
Code(1001)
Mandatory
String

 34 | P a g e
utilityBill
Utility Bill image.
Base64 string of not
more than 100,000
characters in length
Mandatory

String
nationality
Nigerian or
Non_Nigerian
Mandatory

String
otherNationalityType
Only to be included if
nationality is
Non_Nigerian, input your
nationality.
Optional

String
proofOfAddressVerificati on
Proof
of
address
verification. This should
be converted to a base64
String not more than
100,000 characters
Optional

String
signature
Customer Signature
Image. Base64 string of
not more than
Mandatory

String

100,000 characters in
length

idCardFront
Id Card front image.
Base64 string of not more
than 100,000 characters in
length. -
Voter’s card, NIN, Int
Passport, Driver’s
license.
Mandatory

String
idCardBack
Id Card Back image.
Base64 string of not
more than 100,000
characters in length
Optional

String
residentPermit
Resident permit for
foreign nationals.
Base64 string of not
more than 100,000
characters in length
Optional,
Mandatory
for
individuals within
this category
String
pep
Politically exposed person
(Yes or No)
Mandatory
String

 35 | P a g e
Sample Payload
{
"phoneNo": "00000000000",
"postalAddress": "2 merchant bank road lagos",
"taxIDNo": "11111-0001",
"businessName": "9PSB",
"industrialSector": "string",
"email": "abc@gmail.com",
"address": " lagos ",
"companyRegDate": "2023-02-23",
"contactPersonFirstName": "string",
"contactPersonLastName": "string",
"businessType": "coorperative",
"businessTypeName”: "string",
"natureOfBusiness": "string",
"webAddress": "string",
"dateIncorporated": "2023-02-23",
"businessCommencementDate": "2023-02-23",
"registrationNumber": "string",
"cacCertificate": "Base64 image string”,
"scumlCertificate": " Base64 image string ",
"regulatoryLicenseFintech": " Base64 image string ",
"utilityBill": “Base64 image string",
"accountSignatories": [
{
"lastName": "new",
"firstName": "customer",
"otherNames": "customer",
"address": "lagos",
"gender": "male",
"dateOfBirth": "1982-04-06",
"phoneNo": "0010101020",
"placeOfBirth": "lagos",
"nationalIdentityNo": "1111111",
"nextOfKinName": "john hope",
"nextOfKinPhoneNumber": "001010101",
"customerType": "individual",
"branchID": "0",
"bankVerificationNumber": "22123456789",
"email": "abc@gmail.com",
"customerPassportInBytes": " Base64 image string “,
"accountOfficerCode": "1001",

 36 | P a g e
"utilityBill": " Base64 image string ",
"signature": " Base64 image string ",
"idCardFront": " Base64 image string ",
"idCardBack": " Base64 image string ",
"residentPermit": " Base64 image string "
}
],
"directors": [
{
"lastName": "first",
"firstName": "director",
"otherNames": "director",
"address": "lagos",
"gender": "male",
"dateOfBirth": "1982-04-06",
"phoneNo": "08039568340",
"placeOfBirth": "lagos",
"nationalIdentityNo": "1111111",
"nextOfKinName": "john Hope",
"nextOfKinPhoneNumber": "08097777777",
"referralName": "modupe",
"referralPhoneNo": "00000000006",
"customerType": "individual",
"branchID": "0",
"bankVerificationNumber": "12345678987",
"email": "abc@gmail.com",
"customerPassportInBytes": "”,
"accountOfficerCode": "1001",
"utilityBill": " Base64 image string ",
"signature": " Base64 image string ",
"idCardFront": " Base64 image string”
"idCardBack": " Base64 image string ",
"residentPermit": " Base64 image string ",
}
]
}

 37 | P a g e
**RESPONSE BODY**
Field
Description
Type
message
Message response
String
data
JSON Object containing list of banks

See POSTMAN collection for more details
JSON Object
status
Response status of request
String

17b. Open Corporate Account Using Image Files
Description: Open Corporate Account using image files (Multipart File Images) Content-Type:
multipart/form-data. Sample payload can be found in Postman
Collection. Request URL:
http://102.216.128.75:9090/waas/api/v1/open_corporate_account_file_upload

**REQUEST BODY**
Field
Description
Mandatory/Opti onal Type
phoneNo
Organization phone
number (08011111111)
Mandatory
String

postalAddress
Postal address (include
nearest bus stop, city and
state)
Mandatory
String
taxIDNo
TIN of business
Mandatory
String
businessName
Name of Business
Mandatory
String
tradeName
Business Trade name
Mandatory
String
industrialSector
Industrial Sector eg
primary sector ie
Agriculture, mining or
secondary sector ie
Mandatory
String

 38 | P a g e

manufacturing,
construction or tertiary ie
banking, healthcare,
education
or retail

email
Business Email
Mandatory
String
address
Company Operating
Address and state
Mandatory
String

companyRegDate
Date of Registration.
Date format should be
“yyyy-MM-dd”
Optional
String
contactPersonFirstName
Contact person first name
Mandatory
String
contactPersonLastName
Contact person last name
Mandatory
String
businessType
Type of business
Sole_Proprietorship,
Partnership,
Limited_Liability_Com
pany, NGO, Corporations,
Cooperative,
Franchise, Non_Profit,
Social_Enterprise or
Others.
Mandatory
String
businessTypeName
Only to be included if
businessType is Others.
Optional
String
natureOfBusiness
Nature Of Business eg
manufacturing, Retail,
Finance, Hospitality,
Real estate or
Technology.
Mandatory
String
webAddress
Website of organization
Optional
String
dateIncorporated
Date of Incorporation.
Date format should be
“yyyy-MM-dd”
Mandatory
String

 39 | P a g e
businessCommencemen tDate Business
Commencement
Date. Date format
should be “yyyy- MMdd”
Mandatory
String
registrationNumber
Business Registration
Number
Mandatory
String
cacCertificate
CAC certificate image. This
should be an image file
with either .JPG, .PNG
or .JPEG format. Image
Mandatory
String

size should not exceed
100KB.

utilityBill
Image of company
utility bill. This should be an
image file with
either .JPG, .PNG or .JPEG
format. Image size should
not exceed 100KB.
Mandatory
String
proofOfAddressVerificati on
Proof
of
address
verification. This
should be an image file
with either .JPG, .PNG
or .JPEG format. Image
size should not exceed
100KB.
Mandatory
String
scumlCertificate
Image of SCUML
certificate (if
applicable). This should be
an image file with
either .JPG, .PNG or .JPEG
format. Image size should
not exceed 100KB.
Optional,
Mandatory for
businesses that
fall within the
category
String
regulatoryLicenseFintech
Image of FINTECH
License (if applicable). This
should be an image file
with either .JPG, .PNG
or .JPEG format. Image size
should not exceed 100KB.
Optional,
Mandatory for
businesses that
fall within the
category
String

 40 | P a g e
accountSignatories
Payload for signatories of
the organization can be
found in the table below
Mandatory
(Optional for
Sole_Proprietorshi p)
ArrayList<Strin g>
directors
Payload for directors of the
organization can be found in
the table below
Mandatory
ArrayList<Strin g>

Director and Account Signatory Payload
Field
Description
Mandatory/Opti
onal
Type
lastName
Last name
Mandatory
String

firstName
FirstName
Mandatory
String
otherNames
Other Names
Mandatory
String
address
Customer Address
(include full address, city
and state)
Mandatory
String
gender
Customer Gender
(Male or Female)
Mandatory
String
dateOfBirth
The date format
should be “yyyy- MMdd”
Mandatory
String
phoneNo
Phone Number
(08011111111)
Mandatory
String
placeOfBirth
Place of Birth
Optional
String
nationalIdentityNo
## NIN
Optional
String
nextOfKinName
Next of Kin Name
Mandatory
String

 41 | P a g e
nextOfKinPhoneNumber
Next of Kin Phone
Number
(08033333333)
Mandatory
String
customerType
Individual
Mandatory
String
branchID
0
Mandatory
String
bankVerificationNumber
Bank Verification
Number of Customer
Mandatory
String
email
Email address
Mandatory
String
customerPassportInBytes
Customer passport
photo. This should be an
image file with
either .JPG, .PNG
or .JPEG format. Image
size should not exceed
100KB.
Mandatory
String
accountOfficerCode
Account Officer
Code(1001)
Mandatory
String

utilityBill
Utility Bill image. This
should be an image
file with either .JPG, .PNG
or .JPEG format. Image
size should not exceed
100KB.
Mandatory
String
nationality
Nigerian or
Non_Nigerian
Mandatory
String
otherNationalityType
Only to be included if
nationality is
Non_Nigerian, input your
nationality.
Optional
String
proofOfAddressVerificati on
Proof of address
verification. This
should be an image file
with either .JPG,
.PNG or .JPEG format.
Image size should not
exceed 100KB.
Optional
String

 42 | P a g e
signature
Customer Signature
Image. This should be an
image file with
either .JPG, .PNG
or .JPEG format. Image
size should not exceed
100KB.
Mandatory
String
idCardFront
Id Card front image. This
should be an image file
with either .JPG, .PNG
or .JPEG format. Image
size should not exceed
100KB.
-Voter’s card, NIN, Int
Passport,
Driver’s
license.
Mandatory
String
idCardBack
Id Card Back image. This
should be an image file
with either .JPG, .PNG
or .JPEG format. Image
size should not exceed
100KB.
Optional
String
residentPermit
Resident permit for
foreign nationals. This
should be an image file
with either .JPG, .PNG
or .JPEG format. Image
size should not exceed
100KB.
Optional,
Mandatory
for
individuals within
this category
String
pep
Politically exposed person
(Yes or No)
Mandatory
String

 43 | P a g e

**RESPONSE BODY**
Field
Description
Type
message
Message response
String
data
JSON Object containing response payload

See POSTMAN collection for more details
JSON Object
status
Response status of request
String

18. Get Corporate Account Number
Description: Get generated corporate account number.
Request URL: http://102.216.128.75:9090/waas/api/v1/get_account_number

**REQUEST BODY**
Field
Description
Mandatory/Optional
Type
taxIDNo
Corporate Tax Id
Number
Mandatory
String

**RESPONSE BODY**
Field
Description
Type
message
Message response
String

 44 | P a g e
data
JSON Object containing response payload

See POSTMAN collection for more details
JSON Object
status
Response status of request
String

19. Get Corporate Account Status
Description: Get generated corporate account status. Status can be Pending or Approved.
Request URL: http://102.216.128.75:9090/waas/api/v1/get_request_status

**REQUEST BODY**
Field
Description
Mandatory/Optional
Type
accountNumber
Corporate Account
Number
Mandatory
String
**RESPONSE BODY**
Field
Description
Type
message
Message response
String
data
JSON Object containing response payload

See POSTMAN collection for more details
JSON Object
status
Response status of request
String

 45 | P a g e

## QR CODE INTEGRATION
This section describes APIs for QR code integration through WAAS.
Authentication and Authorization remains the same as other Wallet APIs.
All APIs have a generic response Structure as shown below:
AUTHORIZATION:
Header
Description
Data Type
Authorization
Bearer {{access_token}} – from Authentication
String

GENERIC RESPONSE:
Field
Description
Data Type
status
API response status (SUCCESS, PENDING, FAILED)
String
responseCode
API response code
String
message
API response message
String
data
JSON object of details for a particular request
## JSON

Sample Request and Response can be found in Postman Collection

## 1. CREATE MERCHANT
DESCRIPTION: All QR codes are to be tied to a merchant. The endpoint creates or registers a
merchant in the Nibbs QR platform.

URL: POST http://102.216.128.75:9090/waas/api/v1/qr/merchant
REQUEST BODY:
Field
Description
Data type
Mandatory
name
Merchant’s name
String
Y
email
Merchant’s email address
String
N
address
Merchant’s address
String
Y
tin
Merchant’s TIN (Tax Identification number),
Individual or Corporate
String
Y
accountNo
Merchant’s wallet account number – Provided
account number will be bound to the merchant
String
Y

 46 | P a g e
and will be credited directly for all payments
made via generated QR Codes under a
merchant
merchantBearsFee Indicates if merchant should bear charges for a
QR payment. TRUE if merchant should bear,
FALSE if payer should be bear
Boolean
Y

RESPONSE BODY (data):
Field
Description
Data Type
name
Merchant’s name
String
merchantNo
Generated Unique Merchant
Identifier in the Nibbs QR
Ecosystem
String
tin
Merchant’s TIN
String
accountNo
Merchant’s Wallet Account
number
String
accountName
Merchant’s Wallet Account
Name
String
merchantBearsFee
Indicates if merchant is charged
for QR Payments
Boolean

## 2. CREATE MERCHANTS IN BULK
DESCRIPTION: This endpoint creates or registers multiple QR erchants in one request.

URL: POST http://102.216.128.75:9090/waas/api/v1/qr/bulk-merchants
REQUEST BODY:
Field
Description
Data type
Mandatory
List
List of merchants to be created. Fields in single
list entry are same as create merchant above
List
Y

RESPONSE BODY (data):

 47 | P a g e
Field
Description
Data Type
successful
A list of successfully created
merchants from the bulk list
request. Fields in single entry in
list is same entry in CREATE
## MERCHANT
List
failed
A list of failed merchant creation
from the bulk request
String

## FAILED SINGLE ENTRY
Field
Description
Data Type
name
Name of merchant in bulk request
String
tin
TIN of merchant in bulk request
String
reason
Reason for creation failure
String

Sample Response body can be found in Postman Collection

## 3. CREATE FIXED QR CODE
DESCRIPTION: This creates a single FIXED QR Code under a merchant. Fixed QR codes are static
without an expiration and can receive multiple payments.

URL: POST http://102.216.128.75:9090/waas/api/v1/qr/fixed
REQUEST BODY:
Field
Description
Data type
Mandatory
reference
Unique identifier for fixed QR code
String
Y
merchantNo
Merchant Number from CREATE MERCHANT.
Created Fixed QR code will be registered to
merchant and payments made via generated
code will be credited to associated merchant
account number
String
Y
subMerchantName Name to be registered to fixed QR code (e.g.
merchant’s branch or store name etc.)
String
Y
phoneNo
Sub-merchant Phone number to be registered
to fixed QR code
String
Y
email
Sub-merchant email address to be associated
to Fixed QR Code
String
Y

 48 | P a g e
isFixedAmount
Indicates if QR code payment should only
accept a Fixed Amount
Boolean
Y
fixedAmount
Fixed Amount to be accepted for QR Payment
Decimal
N

RESPONSE BODY (data) :
Field
Description
Data Type
codeUrl
Generated Fixed QR Code
String
reference
Reference from request
String
merchantNo
Merchant number from request
String
subMerchantNo
Unique number sub-merchant tied to Generated Fixed
QR code
String
name
Sub-merchant name from request
String
email
Sub-merchant email from request
String
phoneNo
Sub-merchant phone number from request
String
type
QR Code Type - FIXED
String
isFixedAmount
Indicates if amount for Fixed QR Code Payment is fixed
as stated in request
Boolean
fixedAmount
Fixed Amount for QR Code if isFixedAmount is true
Decimal
createdAt
Fixed QR Code creation time
String

## 4. CREATE FIXED QR CODES IN BULK
DESCRIPTION: This endpoint creates bulk FIXED QR codes at one request under a particular
merchant.
URL: POST http://102.216.128.75:9090/waas/api/v1/qr/bulk-fixed
REQUEST BODY:
Field
Description
Data type
Mandatory
merchantNo
Merchant number from CREATE MERCHANT.
Created Bulk Fixed QR codes will be tied to
merchant and payments will be credited to
associated merchant’s account
String
Y
reference
Unique reference for bulk Fixed QR codes
creation.
String
Y

 49 | P a g e
batchList
A list of Fixed QR details to be created. Single
entry in list comprises – name, email, phoneNo,
isFixedAmount, fixedAmount.
List
Y (min 2)

RESPONSE BODY (data):
Field
Description
Data Type
data
List of Created Fixed QR codes
List

## 5. CREATE DYNAMIC QR CODE
DESCRIPTION: Creates a dynamic QR code used to receive ONE TIME payments. Dynamic QR codes
have a default expiry period of 25mins from creation time.

URL: POST http://102.216.128.75:9090/waas/api/v1/qr/dynamic
REQUEST BODY:
Field
Description
Data type
Mandatory
reference
Unique reference for dynamic QR code creation
String
Y
amount
Fixed Amount to be paid
Decimal
Y
subMerchantNo
Sub-merchant number generated from CREATE
FIXED QR CODE. Payment for dynamic QR code
will be tied to sub-merchant and it’s merchant
String
Y
customerName
Customer’s name
String
Y
customerEmail
Customer’s Email
String
Y
customerPhoneNo Customer’s phone number
String
Y

RESPONSE BODY (data) :
Field
Description
Data Type
codeUrl
Generated Dynamic QR Code
String
reference
Reference from request
String
merchantNo
Associated Merchant number
String
subMerchantNo
Associated sub-merchant number
String
orderNo
Unique reference created by 9PSB for Dynamic QR code String
orderSn
Unique serial number from Nibbs for Dynamic QR code
Boolean
name
Customer’s name from request
String
email
Customer’s email from request
String
phoneNo
Customer’s phone number from request
String

 50 | P a g e
type
QR Code Type - DYNAMIC
String
isAmountFixed
Dynamic QR code amounts are always Fixed - TRUE
Boolean
fixedAmount
Fixed Amount from request for Dynamic QR Code
Decimal
createdAt
Dynamic QR Code creation time
String

## 6. GET QR CODE PROPERTIES
DESCRIPTION: Returns a break down of a QR code URL into readable properties.

URL: GET http://102.216.128.75:9090/waas/api/v1/qr/properties
REQUEST PARAM:
Field
Description
Data type
Mandatory
codeUrl
QR Code URL
String
Y

RESPONSE BODY:
Field
Description
Data Type
type
QR Code type – FIXED or DYNAMIC
String
amount
Amount assigned to QR Code. Value will be null for
Fixed QR Code generated with isFixedAmount (false)
Decimal
orderSn
Unique serial no from Nibbs for QR Code. Value will be
null for FIXED QR Code
String
merchantName
Merchant Name under which QR Code was created
String
merchantNo
Merchant number under which QR code was created
String
subMerchantNo
Sub merchant number tied to QR code
Boolean
countryCode
QR Code country code
String
countryName
Country name
String
institutionNumber
Unique number of QR Code generating institution
String
forwardingNumber Usually same as institution number
String
crcCode
CRC16 verification code from NIBBS
String
