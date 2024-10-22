declare namespace Express {
    // extends express-session
    export interface Session {
        org:string
    }

    export interface Request {
        orgUser:any
    }
}