export default function validateNpi(npi: number|string):boolean {
    'use strict';
    if(!npi) {
        //console.log('ERROR: no NPI specified');
        return false;
    }

    let npiString:string = npi.toString();
    let npiLength = npiString.length;
    let isNan = !/^\d+$/.test(npiString);
    let isZeroes = ('0000000000'+npiString).slice(-10) === '0000000000';
    let npiDigits = npiString.split('');
    let lastDigit = npiString.slice(-1);
    let oddTotal = 0;
    let evenTotal = 0;
    let checkTotal = 0;

    if(npiLength !== 10) {
        //console.log('ERROR: invalid length');
        return false;
    }

    if(isNan) {
        //console.log('ERROR: NaN');
        return false;
    }

    if(isZeroes) {
        //console.log('ERROR: all zeroes');
        return false;
    }
    for(var i = npiLength-1; i > 0; i--) {
        let digit = parseInt(npiString.charAt(i-1));
        if((i % 2) !== 0) {
            oddTotal += ((digit<5) ? digit*2 : (digit*2)-9);
        } else {
            evenTotal += digit;
        }
    }
    checkTotal = (24 + evenTotal + oddTotal);
    var ceiling = checkTotal % 10 === 0 ? checkTotal : (Math.ceil((checkTotal+1) / 10) * 10);
    return ((ceiling-checkTotal) === parseInt(lastDigit));
}