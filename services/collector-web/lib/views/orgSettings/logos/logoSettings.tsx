import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'mobx-react';

import { LogoSettingsContainer } from '@containers/LogoSettingsContainer';
import { logoStore } from '@stores/LogoStore'

const stores = { logoStore };

ReactDOM.render(
    <Provider {...stores}>
        <LogoSettingsContainer />
    </Provider>,
    document.getElementById('root')
);