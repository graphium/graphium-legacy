/**
 * Generate a local provider ID for the provider using the first 10 digits of their last name and last 5 digits of their NPI
 * @param lastName The provider's last name
 * @param providerId The provider's NPI
 */
export function generateLocalProviderId(lastName: string, providerId: number) {
  // Get the first 10 characters of the last name and strip it of non a-z characters
  const shortenedLastName: string = lastName
    .replace(/[^\w]/g, "")
    .substr(0, 10)
    .toUpperCase();
  // Get the last 5 digits of the NPI
  const shortenedNpi: string = providerId
    .toString()
    .substr(providerId.toString().length - 5, 5);
  // Return the formatted local provider ID
  return `${shortenedLastName}-${shortenedNpi}`;
}

/**
 * Validate an NPI number
 * @param npiNumber The NPI number
 */
export function isValidNpi(npiNumber: string): boolean {
  "use strict";
  if (!npiNumber) {
    //console.log('ERROR: no NPI specified');
    return false;
  }

  // tslint:disable-next-line:one-variable-per-declaration
  let npi: string = npiNumber.toString(),
    npiLength: number = npi.length,
    isNan: boolean = !/^\d+$/.test(npi),
    isZeroes: boolean = ("0000000000" + npi).slice(-10) === "0000000000",
    npiDigits = npi.split(""),
    lastDigit = npi.slice(-1),
    digit,
    oddTotal = 0,
    evenTotal = 0,
    checkTotal = 0;

  if (npiLength !== 10) {
    //console.log('ERROR: invalid length');
    return false;
  }

  if (isNan) {
    //console.log('ERROR: NaN');
    return false;
  }

  if (isZeroes) {
    //console.log('ERROR: all zeroes');
    return false;
  }
  for (var i = npiLength - 1; i > 0; i--) {
    digit = parseInt(npi.charAt(i - 1));
    if (i % 2 !== 0) {
      oddTotal += digit < 5 ? digit * 2 : digit * 2 - 9;
    } else {
      evenTotal += digit;
    }
  }
  checkTotal = 24 + evenTotal + oddTotal;
  const ceiling =
    checkTotal % 10 === 0 ? checkTotal : Math.ceil((checkTotal + 1) / 10) * 10;
  return ceiling - checkTotal === parseInt(lastDigit);
}
