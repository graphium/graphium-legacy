var Promise = require('bluebird');
var uuid = require('uuid');
var _ = require('lodash');

function getFormDefinitionsForOrg(orgInternalName) {
    var formDefinitions = [];
    
    if(_.includes(['demo1000','org1000','org1001','mwla2142','macd2041','mnca2079','mtas2080','mipn2096','mvdy2097','mmlf2102','mmpp2103','maap2104','masl2106','mlsa2107','mmaa2137','msam2140','maaa2147','miap2153','mmaa2160'], orgInternalName)) {
        formDefinitions.push({
            title: '2017 MACRA Plus (Metro Anesthesia)',
            name: 'Metro2017MacraPlus',
            orgInternalName: orgInternalName,
            systemGlobal: false,
            type: 'data_entry'
        });

        formDefinitions.push({
            title: '2019 MACRA Plus (Metro Anesthesia)',
            name: 'Metro2019MacraPlus',
            orgInternalName: orgInternalName,
            systemGlobal: false,
            type: 'data_entry'
        });

        formDefinitions.push({
            title: '2019 MACRA Team (Metro Anesthesia)',
            name: 'Metro2019Team',
            orgInternalName: orgInternalName,
            systemGlobal: false,
            type: 'data_entry'
        });

        formDefinitions.push({
            title: '2020 MACRA Plus (Metro Anesthesia)',
            name: 'Metro2020MacraPlus',
            orgInternalName: orgInternalName,
            systemGlobal: false,
            type: 'data_entry'
        });

        formDefinitions.push({
            title: '2020 MACRA Team (Metro Anesthesia)',
            name: 'Metro2020Team',
            orgInternalName: orgInternalName,
            systemGlobal: false,
            type: 'data_entry'
        });

        formDefinitions.push({
            title: '2021 MACRA Plus (Metro Anesthesia)',
            name: 'Metro2021MacraPlus',
            orgInternalName: orgInternalName,
            systemGlobal: false,
            type: 'data_entry'
        });

        formDefinitions.push({
            title: '2021 MACRA Team (Metro Anesthesia)',
            name: 'Metro2021Team',
            orgInternalName: orgInternalName,
            systemGlobal: false,
            type: 'data_entry'
        });

        formDefinitions.push({
            title: '2023 MACRA Standard (Metro Anesthesia)',
            name: 'Metro2023MacraStandard',
            orgInternalName: orgInternalName,
            systemGlobal: false,
            type: 'data_entry'
        });

        formDefinitions.push({
            title: '(Test) 2017 MACRA Plus (Metro Anesthesia)',
            name: 'TEST.Metro2017MacraPlus',
            orgInternalName: orgInternalName,
            systemGlobal: false,
            type: 'data_entry'
        });
    }

    if(_.includes(['org1000','org1001','pams2002'], orgInternalName)) {
        formDefinitions.push({
            title: '2017 MACRA Plus (Premier Pathways)',
            name: 'PP17.001',
            orgInternalName: orgInternalName,
            systemGlobal: false,
            type: 'data_entry'
        });

        formDefinitions.push({
            title: '2019 MACRA Plus (Premier Pathways)',
            name: 'PP19.001',
            orgInternalName: orgInternalName,
            systemGlobal: false,
            type: 'data_entry'
        });

        formDefinitions.push({
            title: '2020 MACRA Plus (Premier Pathways)',
            name: 'PP20.001',
            orgInternalName: orgInternalName,
            systemGlobal: false,
            type: 'data_entry'
        });

        formDefinitions.push({
            title: '2023 MACRA Plus (Premier Pathways)',
            name: 'PP23.001',
            orgInternalName: orgInternalName,
            systemGlobal: false,
            type: 'data_entry'
        });

        formDefinitions.push({
            title: '2024 MACRA Plus (Premier Pathways)',
            name: 'PP24.001',
            orgInternalName: orgInternalName,
            systemGlobal: false,
            type: 'data_entry'
        });
    }

    if(_.includes(['org1000','org1001','napl2076'], orgInternalName)) {
        formDefinitions.push({
            title: '2019 MACRA Simple (Nevada Anesthesia Partners)',
            name: 'NAP19.001',
            orgInternalName: orgInternalName,
            systemGlobal: false,
            type: 'data_entry'
        });
    }

    formDefinitions.push({
        title: '2016 PQRS Ready',
        name: 'PqrsReady',
        systemGlobal: true,
        type: 'data_entry'
    });

    formDefinitions.push({
        title: '2017 MACRA Ready - Plus',
        name: 'MCRPLS17.001',
        systemGlobal: true,
        type: 'data_entry'
    });

    formDefinitions.push({
        title: '2017 MACRA Ready - Simple',
        name: 'MCRSMP17.001',
        systemGlobal: true,
        type: 'data_entry'
    })

    formDefinitions.push({
        title: '2019 MACRA Ready - Plus',
        name: 'MCRPLS19.001',
        systemGlobal: true,
        type: 'data_entry'
    });

    formDefinitions.push({
        title: '2019 MACRA Ready - Simple',
        name: 'MCRSMP19.001',
        systemGlobal: true,
        type: 'data_entry'
    });

    formDefinitions.push({
        title: '2020 MACRA Ready - Plus',
        name: 'MCRPLS20.001',
        systemGlobal: true,
        type: 'data_entry'
    });

    formDefinitions.push({
        title: '2020 MACRA Ready - Simple',
        name: 'MCRSMP20.001',
        systemGlobal: true,
        type: 'data_entry'
    });

    formDefinitions.push({
        title: '2021 MACRA Ready - Plus',
        name: 'MCRPLS21.001',
        systemGlobal: true,
        type: 'data_entry'
    });

    formDefinitions.push({
        title: '2021 MACRA Ready - Simple',
        name: 'MCRSMP21.001',
        systemGlobal: true,
        type: 'data_entry'
    });

    formDefinitions.push({
        title: '2023 MACRA Ready - Plus',
        name: 'MCRPLS23.001',
        systemGlobal: true,
        type: 'data_entry'
    });

    formDefinitions.push({
        title: '2023 MACRA Ready - Simple',
        name: 'MCRSMP23.001',
        systemGlobal: true,
        type: 'data_entry'
    });

    formDefinitions.push({
        title: '2024 MACRA Ready - Plus',
        name: 'MCRPLS24.001',
        systemGlobal: true,
        type: 'data_entry'
    });

    formDefinitions.push({
        title: '2024 MACRA Ready - Simple',
        name: 'MCRSMP24.001',
        systemGlobal: true,
        type: 'data_entry'
    });

    formDefinitions.push({
        title: 'Test External Web Form',
        name: 'TEST.ExternalWebForm',
        systemGlobal: true,
        type: 'external_web_form'
    })

    return Promise.resolve(formDefinitions);
}

function getFormDefinitionByName(orgInternalName, dataEntryFormDefinitionName) {
    return getFormDefinitionsForOrg(orgInternalName)
    .then(function(formDefinitions) {
        var formDefinition = _.find(formDefinitions, {name: dataEntryFormDefinitionName});

        if(!formDefinition) {
            return Promise.resolve(null);
            //return Promise.reject(new Error('Unable to find form for org with form name: ' + dataEntryFormDefinitionName));
        }  
        else {
            return Promise.resolve(formDefinition);
        }
    });
}

module.exports = {
    getFormDefinitionsForOrg: getFormDefinitionsForOrg,
    getFormDefinitionByName: getFormDefinitionByName
};