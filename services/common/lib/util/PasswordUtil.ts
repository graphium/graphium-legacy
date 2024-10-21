const SYMBOLS: string = `~!@#$%^&*()-_=+[{]}\\|;:'\",<.>/?`;

function containsSymbol(password: string): string {
  const listOfSymbols: string[] = SYMBOLS.split("");
  return listOfSymbols.find(symbol => password.indexOf(symbol) > -1);
}

function containsNumber(password: string): boolean {
  const match: string[] = password.match(/\d/);
  return match && match.length > 0;
}

function containsUppercase(password: string): boolean {
  const match: string[] = password.match(/[A-Z]/);
  return match && match.length > 0;
}

function containsLowercase(password: string): boolean {
  const match: string[] = password.match(/[a-z]/);
  return match && match.length > 0;
}

export function validatePassword(password: string): boolean {
  if (!password || password === "" || password.indexOf(" ") > -1) {
    return false;
  }

  if (
    password.length < 10 ||
    !containsSymbol(password) ||
    !containsNumber(password) ||
    !containsUppercase(password) ||
    !containsLowercase(password)
  ) {
    return false;
  }

  return true;
}
