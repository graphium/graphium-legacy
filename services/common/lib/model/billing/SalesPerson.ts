
export class SalesPerson {
    salesPersonId: string;
    firstName: string;
    lastName: string;
    email: string;

    static fromAirtable(id:string, data:any):SalesPerson {
        let sp = new SalesPerson();
        sp.salesPersonId = id;
        sp.firstName = data['First Name'];
        sp.lastName = data['Last Name'];
        sp.email = data['Email'];
        return sp;
    }
}