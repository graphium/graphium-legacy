import * as Bluebird from 'bluebird';
import * as Quickbooks from 'node-quickbooks';

Quickbooks.setOauthVersion('2.0');

Bluebird.promisifyAll(Quickbooks.prototype);

export default Quickbooks;