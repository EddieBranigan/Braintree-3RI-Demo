  var payButton = document.querySelector("#submit");
  var insuranceAmount = 10;
  var productAmount = 500;
  var totalAmount = insuranceAmount + productAmount;
  var buyerAddress = {
    givenName: "Sherlock",
    surname: "Holmes",
    phoneNumber: "020 7224 3688",
    streetAddress: "221B Baker Street",
    locality: "London",
    postalCode: "NW1 6XE",
    countryCodeAlpha2: "GB",
  };
  var deviceData;
  let authFingerprint = "";
  let authenticationId = "";
  let paymentMethodId = "";
  let newCavv =  "";
  let eventCount = 0;
  let clientTokenMessage = `A <b>client token is create</b> by the D&G server using the customer id. This client token is returned to the client-side and used as a form of authorization to initialise the Braintree components. This client token is stored and used later for 3RI.`;
  let ctaMessage =
    "Customer enters their payment details. The customer details are then <b>tokenized</b>. This token is then used for 3DS authentication. The amount for authorization will before the total amount of the product and the insurance.";
  let threedsMessage =
    "The Customer is then prompted to <b>Authenticate their payment using 3DS</b>. This can be prompted by their issuing bank by OTP(over the phone) message or by their banking application.";
  let payloadMessage =
    "After successful verification by 3DS, a <b>3DS enriched nonce is returned</b>.";
  let settleMessage =
    "The 3DS enriched nonce can then be <b>submitted for settlment</b> to capture the funds for the insurance amount of the transaction.";
  let threeRIRequestMessage =
    "In order to generate the <b>CAVV</b> value to pass to the partner merchant to capture the remaining amount in a transaction, the D&G server will need to use the <b>'performThreeDSecureLookup'</b> mutation. The original client token will need to be decoded from Base64 and the <b>authorization fingerprint extracted</b>. This auth fingerprint will be used as the Authorization header for the mutation and the <b>3DS authorization id</b> returned during the initial lookup will also be needed along with the <b>multi-use payment token</b>(also known as a payment method id).";
    let threeRIResponseMessage = "After the D&G has called the 'performThreeDSecureLookup' mutation, a new cavv is generated. This cavv can be used by the partner merchant to capture the amount required for their transaction. This information is shared with the partner merchant using the forward API."
    let forwardapiResponseMessage = "The newly created CAVV value and 3DS authorization id are sent to the partner merchant."

  function startPaymentFlow() {
    logEvent(clientTokenMessage, "startDiv");
    startHF();
    document.getElementById("loadingMessage").style.display = "block";
  }

  function startHF() {
    fetch("/checkout/clientToken", { mode: "cors" })
      .then((response) => response.text())
      .then((clientToken) => {
        authFingerprint = getAuthFingerprint(clientToken);
        return braintree.client.create({ authorization: clientToken });
      })
      .then((clientInstance) => {
        document.getElementById("hostedFieldsDiv").style.display = "block";
        document.getElementById("loadingMessage").style.display = "none";
        return Promise.all([
          braintree.hostedFields.create({
            client: clientInstance,
            styles: { input: { "text-align": "center" } },
            fields: {
              number: {
                selector: "#cc-number",
                prefill: "4000 0000 0000 2701",
              }, // Visa test card number for 3RI
              cvv: { selector: "#cc-cvv", prefill: "123" },
              expirationDate: {
                selector: "#cc-expiration",
                prefill: "01/2027",
              },
            },
          }),
          braintree.threeDSecure.create({ client: clientInstance, version: 2 }),
          braintree.dataCollector.create({ client: clientInstance }),
        ]);
      })
      .then(
        ([hostedFieldsInstance, threeDSecureInstance, deviceDataInstance]) => {
          deviceData = deviceDataInstance.deviceData;

          payButton.addEventListener("click", () => {
            logEvent(ctaMessage, "hostedFieldsDiv");
            hostedFieldsInstance
              .tokenize()
              .then((payload) => {
                logEvent(threedsMessage, "threedsResponseDiv");
                return threeDSecureInstance.verifyCard({
                  onLookupComplete: (data, next) => next(),
                  collectDeviceData: true,
                  challengeRequested: true, // Required for recurring transactions
                  amount: totalAmount,
                  nonce: payload.nonce,
                  bin: payload.details.bin,
                  billingAddress: buyerAddress,
                });
              })
              .then((payload) => {
                logEvent(payloadMessage, "threedsResponseDiv");
                authenticationId =
                  payload.threeDSecureInfo.threeDSecureAuthenticationId;
                document.getElementById("threedsResponseDiv").style.display =
                  "block";
                document.getElementById(
                  "threedsResponse"
                ).innerHTML = `<h3>3DS enriched nonce returned:</h3><br>${JSON.stringify(payload.nonce)}`;
                fetch("/checkout/settle", {
                  method: "POST",
                  body: JSON.stringify({
                    paymentMethodId: payload.nonce,
                    deviceData: deviceData,
                    authenticationId: authenticationId,
                    amount: insuranceAmount
                  }),
                  headers: { "Content-Type": "application/json" },
                })
                  .then((response) => response.json())
                  .then((result) => {
                    paymentMethodId =
                      result.chargeCreditCard.transaction.paymentMethod.id;
                    logEvent(settleMessage, "checkoutMessageDiv");
                    document.getElementById(
                      "checkoutMessageDiv"
                    ).style.display = "block";
                    document.getElementById(
                      "checkoutMessage"
                    ).innerHTML = `<h3>The response from settling the transaction:</h3>\n<pretty-json expand="6">${JSON.stringify(
                      result,
                      null,
                      3
                    )}</pretty-json>`;
                    document.getElementById("3riDiv").style.display = "block";
                    logEvent(threeRIRequestMessage, "3riDiv");
                    document.getElementById(
                      "threeRIFields"
                    ).innerHTML = `<h3>Information required for creating CAVV value for partner merchant</h3><h4>Authorization fingerprint:</h4><p>${authFingerprint}</p>\n<h4>3DS authentication id:</h4><p>${authenticationId}</p>\n<h4>Payment method id:</h4><p>${paymentMethodId}</p>`;
                  });
              })
              .catch((err) => {
                console.error("Error in verification:", err);
              });
          });
        }
      )
      .catch((error) => {
        console.error("Error setting up payment:", error);
      });
  }

  function getThreeRILookup() {
    fetch("/checkout/3RI", {
      method: "POST",
      body: JSON.stringify({
        authFingerprint: authFingerprint,
        authenticationId: authenticationId,
        paymentMethodId: paymentMethodId,
        amount: productAmount
      }),
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => response.json())
      .then((result) => {
        logEvent(threeRIResponseMessage, "3riResponseDiv")
        document.getElementById("3riResponseDiv").style.display = "block";
        document.getElementById(
          "threeRIResMessageDiv"
        ).innerHTML = `<h3>'performThreeDSecureLookup' response:</h3>\n<pretty-json expand="6">${JSON.stringify(result)}</pretty-json>`;
        document.getElementById("forwardApiDiv").style.display = "block";
      });
  }

  function logEvent(message, associatedDivId) {
    eventCount++;
    const eventLog = document.getElementById("eventLog");
    const newLog = document.createElement("p");
  
    // Associate the log entry with a div in the main-section
    newLog.innerHTML = eventCount + ". " + message;
    newLog.dataset.divId = associatedDivId;  // Store associated div ID in a data attribute
  
    // Add hover effect
    newLog.addEventListener("mouseover", function() {
      const targetDiv = document.getElementById(this.dataset.divId);
      if (targetDiv) {
        targetDiv.classList.add("highlighted");
      }
    });
  
    newLog.addEventListener("mouseout", function() {
      const targetDiv = document.getElementById(this.dataset.divId);
      if (targetDiv) {
        targetDiv.classList.remove("highlighted");
      }
    });
  
    eventLog.appendChild(newLog);
    eventLog.scrollTop = eventLog.scrollHeight;
  }

  function getAuthFingerprint(clientToken) {
    return JSON.parse(atob(clientToken)).authorizationFingerprint.slice(0, -13);
  }

  function sendCavv() {
    logEvent(forwardapiResponseMessage, "forwardApiDiv")
    fetch("/checkout/forwardApi", {
      method: "POST",
      body: JSON.stringify({
        authFingerprint: authFingerprint,
        authenticationId: authenticationId,
        paymentMethodId: paymentMethodId,
        amount: productAmount,
      }),
      headers: { "Content-Type": "application/json" },
    })
  }