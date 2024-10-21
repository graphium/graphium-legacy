import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'mobx-react';

import { DataEntryErrorsContainer } from '@containers/DataEntryErrorsContainer';
import { DataEntryErrorApi } from '@api/DataEntryErrorApi';
import { DataEntryErrorStore } from '@stores/dataEntryErrorStore';
import { FacilityApi } from '@api/FacilityApi';
import { FacilityStore } from '@stores/FacilityStore';
import { ProviderApi } from '@api/ProviderApi';
import { ProviderStore } from '@stores/ProviderStore';

const facilityStore: FacilityStore = new FacilityStore(new FacilityApi());
const providerStore: ProviderStore = new ProviderStore(new ProviderApi());

const dataEntryErrorStore: DataEntryErrorStore = new DataEntryErrorStore(
    new DataEntryErrorApi(),
    facilityStore,
    providerStore
);

const stores = { dataEntryErrorStore, facilityStore, providerStore };

ReactDOM.render(
    <Provider {...stores}>
        <DataEntryErrorsContainer />
    </Provider>,
    document.getElementById('root')
);
