"use strict";

const BASE_URL = "https://api.frankfurter.dev/v1/latest";
const dropdowns = document.querySelectorAll(".dropdown select");
const button = document.querySelector("form button");
const form = document.querySelector("form");
const amount = document.querySelector(".amount input");
const fromCurr = document.querySelector(".from select");
const toCurr = document.querySelector(".to select");
const msg = document.querySelector(".msg");

let controller = null;
let requestId = 0;
const TIMEOUT = 10000;

for (let select of dropdowns) {
    for (let currCode in countryList) {
        let newOption = document.createElement("option");
        newOption.innerText = currCode;
        newOption.value = currCode;

        if (select.name === "from" && currCode === "USD") {
            newOption.selected = true;
        } else if (select.name === "to" && currCode === "INR") {
            newOption.selected = true;
        }

        select.append(newOption);
    }

    select.addEventListener("change", (event) => {
        updateFlag(event.target);
        updateExchangeRate();
    });
}

function updateFlag(element) {
    let currCode = element.value;
    let countryCode = countryList[currCode];
    let img = element.parentElement.parentElement.querySelector("img");

    if (!countryCode) {
        console.error("Country code not found:", currCode);
        return;
    }

    img.src = `https://flagsapi.com/${countryCode}/flat/64.png`;
    img.onerror = () => {
        img.alt = "Flag not available";
    };
}

updateFlag(fromCurr);
updateFlag(toCurr);

function formatAmount(value) {
    return new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

async function updateExchangeRate() {
    const currentRequest = ++requestId;

    if (controller) {
        controller.abort();
        controller = null;
    }

    const amtVal = Number(amount.value.trim());

    if (
        amount.value.trim() === "" ||
        !Number.isFinite(amtVal) ||
        amtVal <= 0
    ) {
        msg.innerText = "Please enter a valid amount greater than zero.";
        button.disabled = false;
        button.innerText = "Get Exchange Rate";
        return;
    }

    const fromCode = fromCurr.value;
    const toCode = toCurr.value;

    if (fromCode === toCode) {
        msg.innerText = `${formatAmount(amtVal)} ${fromCode} = ${formatAmount(amtVal)} ${toCode}`;
        button.disabled = false;
        button.innerText = "Get Exchange Rate";
        return;
    }

    const URL = `${BASE_URL}?base=${encodeURIComponent(fromCode)}&symbols=${encodeURIComponent(toCode)}`;

    controller = new AbortController();
    const currentController = controller;

    button.disabled = true;
    button.innerText = "Loading...";
    msg.innerText = "Getting exchange rate...";

    const timeoutId = setTimeout(() => {
        currentController.abort();
    }, TIMEOUT);

    try {
        const response = await fetch(URL, {
            method: "GET",
            signal: currentController.signal,
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error("Currency pair not found.");
            }

            if (response.status >= 500) {
                throw new Error("Server error. Try again later.");
            }

            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();

        if (currentRequest !== requestId) {
            return;
        }

        if (
            !data ||
            !data.rates ||
            typeof data.rates[toCode] !== "number" ||
            !Number.isFinite(data.rates[toCode]) ||
            data.rates[toCode] <= 0
        ) {
            throw new Error("Invalid exchange rate received.");
        }

        const rate = data.rates[toCode];
        const finalAmount = amtVal * rate;

        if (!Number.isFinite(finalAmount)) {
            throw new Error("Converted amount is too large.");
        }

        msg.innerText = `${formatAmount(amtVal)} ${fromCode} = ${formatAmount(finalAmount)} ${toCode}`;

        console.log("API Response:", data);
        console.log("Exchange Rate:", rate);
        console.log("Converted Amount:", finalAmount);

    } catch (error) {
        if (currentRequest !== requestId) {
            return;
        }

        if (error.name === "AbortError") {
            msg.innerText = "Request timed out. Please try again.";
        } else {
            console.error("Error:", error);
            msg.innerText = error.message || "Something went wrong.";
        }

    } finally {
        clearTimeout(timeoutId);

        if (currentRequest === requestId) {
            button.disabled = false;
            button.innerText = "Get Exchange Rate";
            controller = null;
        }
    }
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    updateExchangeRate();
});

updateExchangeRate();