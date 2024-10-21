export class TableNameUtil {

    public static getPrimaryFormTable(modelName:string):string {
        return ("enctr_form_" + modelName).toLowerCase();
    }

    public static getStrokeTableName(modelName:string):string {
        return ("page_" + modelName + "_stroke").toLowerCase();
    }

    public static getStrokeSequenceName(modelName:string):string {
        return TableNameUtil.getStrokeTableName(modelName) + "_seq";
    }

    public static getBitmapTableName(modelName:string):string {
        return ("page_" + modelName + "_bmp").toLowerCase();
    }

    public static getDetailTableName(modelName:string):string {
        return ("page_" + modelName + "_dtl").toLowerCase();
    }

    public static getPageTableName(modelName:string):string {
        return ("page_" + modelName).toLowerCase();
    }

}