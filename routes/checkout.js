const express = require("express");
const router = express.Router();
const dotenv = require("dotenv").config();
const axios = require("axios");

const BRAINTREE_MERCHANT_ID = process.env.BT_MERCHANT_ID;
const BRAINTREE_PUBLIC_KEY = process.env.BT_PUBLIC_KEY;
const BRAINTREE_PRIVATE_KEY = process.env.BT_PRIVATE_KEY;
const BRAINTREE_GRAPHQL_URL = process.env.BT_GRAPHQL_URL;

const BRAINTREE_AUTHORIZATION = Buffer.from(
  `${BRAINTREE_PUBLIC_KEY}:${BRAINTREE_PRIVATE_KEY}`
).toString("base64");

router.get("/clientToken", async (req, res) => {
  const CREATE_CLIENT_TOKEN_MUTATION = `
    mutation CreateClientToken($input: CreateClientTokenInput!) {
      createClientToken(input: $input) {
        clientToken
      }
    }
  `;

  const CLIENT_TOKEN_INPUT = {
    input: {
      clientToken: {
        merchantAccountId: "IntegrationTutorials-GB",
        customerId: "Y3VzdG9tZXJfNDkwMTk5OTAzMjE",
      },
    },
  };

  try {
    const graphqlQuery = {
      query: CREATE_CLIENT_TOKEN_MUTATION,
      variables: CLIENT_TOKEN_INPUT,
    };

    const response = await axios.post(BRAINTREE_GRAPHQL_URL, graphqlQuery, {
      headers: {
        Authorization: `Basic ${BRAINTREE_AUTHORIZATION}`,
        "Content-Type": "application/json",
        "Braintree-Version": "2024-10-01",
      },
    });

    const clientToken = response.data.data.createClientToken.clientToken;
    res.send(clientToken);
  } catch (error) {
    console.error(
      "Error fetching client token:",
      error.response?.data || error.message
    );
    res.status(500).send("Error fetching client token.");
  }
});

router.post("/settle", async (req, res) => {
  const { authenticationId, paymentMethodId, amount } = req.body;
  // GraphQL mutation for settling (charging) a transaction
  const CHARGE_CREDIT_CARD_MUTATION = `
    mutation ChargeCreditCard($input: ChargeCreditCardInput!) {
      chargeCreditCard(input: $input) {
        transaction {
          id
          legacyId
          status
          createdAt
          amount {
            value
            currencyCode
          }
          customer {
            id
            email
            firstName
            lastName
          }
          paymentMethod {
            id
            legacyId
            usage
          }
          paymentMethodSnapshot {
            ... on CreditCardDetails {
              threeDSecure {
                authentication {
                  cavv
                  liabilityShifted
                  liabilityShiftPossible
                  threeDSecureServerTransactionId
                }
              }
            }
          }
        }
      }
    }
  `;

  // Input data for the mutation
  const CHARGE_CREDIT_CARD_INPUT = {
    input: {
      paymentMethodId: paymentMethodId,
      transaction: {
        customerId: "Y3VzdG9tZXJfNDkwMTk5OTAzMjE",
        vaultPaymentMethodAfterTransacting: {
          when: "ON_SUCCESSFUL_TRANSACTION",
        },
        amount: amount,
        merchantAccountId: "IntegrationTutorials-GB",
        paymentInitiator: "RECURRING_FIRST",
      },
      options: {
        threeDSecureAuthentication: {
          authenticationId: authenticationId,
        },
      },
    },
  };

  try {
    // GraphQL request payload
    const graphqlQuery = {
      query: CHARGE_CREDIT_CARD_MUTATION,
      variables: CHARGE_CREDIT_CARD_INPUT,
    };

    // Make the request to Braintree GraphQL API using Basic Authentication
    const response = await axios.post(BRAINTREE_GRAPHQL_URL, graphqlQuery, {
      headers: {
        Authorization: `Basic ${BRAINTREE_AUTHORIZATION}`,
        "Content-Type": "application/json",
        "Braintree-Version": "2024-10-01",
      },
    });

    // Extract transaction details from the GraphQL response
    const transaction = response.data.data;

    // Send the transaction details to the client
    res.send(transaction);
  } catch (error) {
    console.error(
      "Error processing transaction:",
      error.response?.data || error.message
    );
    res.status(500).send("Error processing transaction.");
  }
});

router.post("/3ri", async (req, res) => {
  console.log('3RI endpoint contacted')
  const { authenticationId, paymentMethodId, amount, authFingerprint } = req.body;

  const PERFORMTHREEDSECURELOOKUP = `
  mutation PerformThreeDSecureLookup($input: PerformThreeDSecureLookupInput!) {
    performThreeDSecureLookup(input: $input) {
        paymentMethod {
            details {
                ... on CreditCardDetails {
                    threeDSecure {
                        authentication {
                            cavv
                        }
                    }
                }
            }
        }
      threeDSecureLookupData {
        authenticationId
      }
    }
  }`;
  const PERFORMTHREEDSECURELOOKUPINPUT = {
    input: {
      paymentMethodId: paymentMethodId,
      amount: amount,
      merchantInitiatedRequest: {
        merchantOnRecordName: "PARTNER_MERCHANT",
        requestType: "PAYMENT_WITH_MULTIPLE_MERCHANTS",
        priorAuthentication: {
          authenticationId: authenticationId,
        },
      },
    },
  };

  try {
    const graphqlQuery = {
      query: PERFORMTHREEDSECURELOOKUP,
      variables: PERFORMTHREEDSECURELOOKUPINPUT,
    };

    // Make the request to Braintree GraphQL API using Basic Authentication
    const response = await axios.post(BRAINTREE_GRAPHQL_URL, graphqlQuery, {
      headers: {
        Authorization: `Bearer ${authFingerprint}`,
        "Content-Type": "application/json",
        "Braintree-Version": "2024-10-01",
      },
    });

    // Extract transaction details from the GraphQL response
    const transaction = response.data.data;
    console.log('3RI response sent')
    console.log(transaction);
    res.send(transaction);
  } catch (error) {
    console.error(
      "Error processing 3RI request:",
      error.response?.data || error.message
    );
    res.status(500).send("Error processing 3RI request.");
  }
});

router.post("forwardApi", async (req, res) => {

const {paymentMethodId, amount, Cavv, authenticationId } = req.body;

  axios.post('https://forwarding.sandbox.braintreegateway.com', {
    merchant_id: BRAINTREE_MERCHANT_ID,
    payment_method_token: paymentMethodId,
    url: "https://httpbin.org/post",
    method: 'POST',
    name: 'PARTNER_MERCHANT_PROCESSOR', // Value to be used to identify requests in future
    /* Use "config" in sandbox but will replaced with "name" property above */
    override: {
        header: {
            /* Example header properties */
            Accept: 'application/json',
            'Content-Type' : 'application/json',
            'Idempotency-Key': uuid() 
        },
        // Non PCI sensitive payload that Partner Merchant's processor expects to receive - will vary depending on procesessor
        body: {
            amount: {
                currency: 'GBP',
                value: amount
            },
            reference: 'PARTNER_MERCHANT_REF_NUMBER',
            paymentMethod: { type: 'scheme' },
            threeDSecure: {
                cavv: Cavv,
                authenticationId: authenticationId
            }
        }
    },
    config: {
        name: 'PARTNER_MERCHANT_PROCESSOR',
        methods: ['POST'],
        url: "^https://httpbin\.org/post$",
        request_format: { '/body': 'json', '/header': 'json' },
        types: ['NetworkTokenizedCard'],
        // PCI sensitive payload that Partner Merchant's processor expects to receive
        transformations: [
            {
                path: '/body/paymentMethod/number',
                value: '$number'
            },
            {
                path: '/body/paymentMethod/expiryMonth',
                value: '$expiration_month'
            },
            {
                path: '/body/paymentMethod/expiryYear',
                value: '$expiration_year'
            },
            {
                path: '/body/paymentMethod/cvc',
                value: '$cvv'
            }
        ]
    }
}, {
    auth: { 
        username: BRAINTREE_PUBLIC_KEY, // Use D&G's public key
        password: BRAINTREE_PRIVATE_KEY  // Use D&G's private key
    },
    headers: { 
        'Content-Type': 'application/json' 
    }
})
});

module.exports = router;