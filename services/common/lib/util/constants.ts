export const REFERENCE_LIST_PROPERTY_TYPES = [
    {
        value: "string",
        label: "Text"
    },
    {
        value: "number",
        label: "Number"
    },
    {
        value: "boolean",
        label: "Checkbox"
    }
];

interface Report {
    id: string;
    name: string;
    disabled?: boolean;
    chartTypes: string[];
    requiredParams?: string[];
}

interface ReportCategory {
    id: string;
    name: string;
    reports: Report[];
}

export const AVAILABLE_REPORTS: ReportCategory[] = [
    {
        id: "patientPopulation",
        name: "Patient Population",
        reports: [
            {
                id: "population-status",
                name: "All Patients by Status",
                chartTypes: ["table", "column", "pie"]
            },
            {
                id: "enrollment-duration",
                name: "Active Patients by Enrollment Duration",
                chartTypes: ["table", "column", "pie"]
            },
            {
                id: "population-race",
                name: "Active Patients by Race",
                chartTypes: ["table", "column", "pie"]
            },
            {
                id: "population-ethnicity",
                name: "Active Patients by Ethnicity",
                chartTypes: ["table", "column", "pie"]
            },
            {
                id: "population-age",
                name: "Active Patients by Age",
                chartTypes: ["table", "column", "pie"]
            },
            {
                id: "population-gender",
                name: "Active Patients by Gender",
                chartTypes: ["table", "column", "pie"]
            }
        ]
    },
    {
        id: "patientNeeds",
        name: "Patient Needs",
        reports: [
            {
                id: "needs-status",
                name: "All Needs by Status",
                chartTypes: ["table", "column", "pie"]
            },
            {
                id: "all-by-type",
                name: "All Needs by Type",
                chartTypes: ["table", "column", "pie"]
            },
            {
                id: "open-by-type",
                name: "Open Needs by Status",
                chartTypes: ["table", "column", "pie"]
            }
        ]
    },
    {
        id: "patientMedications",
        name: "Patient Medications",
        reports: [
            {
                id: "medications-by-common-name",
                name: "Active Medications by Common Name",
                chartTypes: ["table", "column", "pie"]
            },
            {
                id: "medications-by-brand-name",
                name: "Active Medications by Brand Name",
                chartTypes: ["table", "column", "pie"]
            },
            {
                id: "opioids-by-common-name",
                name: "Active Opioids by Common Name",
                chartTypes: ["table", "column", "pie"]
            },
            {
                id: "opioids-by-brand-name",
                name: "Active Opioids by Brand Name",
                chartTypes: ["table", "column", "pie"]
            }
        ]
    },
    {
        id: "visits",
        name: "Visits",
        reports: [
            {
                id: "visit-type",
                name: "Total Visits by Type",
                requiredParams: ["fromDate", "toDate"],
                chartTypes: ["table", "column", "pie"]
            },
            {
                id: "team-minutes",
                name: "Total Visit Time by Type",
                chartTypes: ["table", "column", "pie"]
            },
            {
                id: "team-average",
                name: "Average Visit Duration by Type",
                chartTypes: ["table", "column", "line"]
            }
        ]
    },
    {
        id: "scheduling",
        name: "Scheduling",
        reports: [
            {
                id: "scheduling-status",
                name: "All Tasks by Status",
                chartTypes: ["table", "column", "pie"]
            },
            {
                id: "tasks-by-team",
                name: "Completed Tasks by Team",
                requiredParams: ["fromDate", "toDate"],
                chartTypes: ["table", "column", "pie"]
            },
            {
                id: "tasks-by-type",
                name: "Completed Tasks by Type",
                requiredParams: ["fromDate", "toDate"],
                chartTypes: ["table", "column", "pie"]
            },
            {
                id: "team-utilization",
                name: "Team Utilization",
                chartTypes: ["table", "column", "heat"]
            }
        ]
    }
];
