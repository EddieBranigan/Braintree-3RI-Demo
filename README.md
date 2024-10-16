This is a demo to show the payment flow on Braintree for a merchant and partner merchant capturing payments for two transactions using 3DS authentication, 3RI and the Forwarding API.

## Installation
In terminal run the below command to install the dependencies from the package file.
```
npm install
```

## Setting up credentials
In the root folder, create a .env file and add your Braintree API credentials to the folder. The example.env file is given as an example.

## Starting the server
To start the server, type the below command in terminal:
```
node run dev
```

In your browser go to https://localhost:3000 to view the demo payment flow.

Technical documentation for 3RI can be viewed here:
https://developer.paypal.com/braintree/docs/guides/3d-secure/3ri
