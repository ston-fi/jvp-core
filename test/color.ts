/* Examples of colored strings:
    "<r>Red <g>green"
    "<bld><r>Red and bold <g>green and bold"
    "<bld><r>Red and bold <clr><g>green"
*/
const styles: { [id: string]: string } = {
    clr     : '\x1b[0m', // clear
    clear   : '\x1b[0m',

    bold    : '\x1b[1m', // bold
    bld     : '\x1b[1m',

    fdd     : '\x1b[2m', // faded

    italic  : '\x1b[3m', // italic
    itl     : '\x1b[3m', 

    line    : '\x1b[4m', // underscore
    und     : '\x1b[4m', 

    s_flash : '\x1b[5m', // slow flash
    sfl     : '\x1b[5m', 

    f_flash : '\x1b[6m', // fast flash
    ffl     : '\x1b[6m', 

    inversion : '\x1b[7m', // invert text and background color
    inv       : '\x1b[7m',

    // Text styles
    blk   : '\x1b[30m', // black
    black : '\x1b[30m',
    k     : '\x1b[30m',

    red   : '\x1b[31m', // red
    r     : '\x1b[31m',

    grn   : '\x1b[32m', // green
    green : '\x1b[32m', 
    g     : '\x1b[32m',

    yel   : '\x1b[33m', // yellow
    yellow: '\x1b[33m',
    y     : '\x1b[33m',

    blue  : '\x1b[34m', // blue
    b     : '\x1b[34m',

    prp    : '\x1b[35m', // magenta
    purple : '\x1b[35m',
    mgt    : '\x1b[35m', 
    magenta: '\x1b[35m',
    m      : '\x1b[35m',

    trq   : '\x1b[36m', // cyan
    cyan  : '\x1b[36m',
    c     : '\x1b[36m',

    wht   : '\x1b[37m', // white
    white : '\x1b[37m', 
    w     : '\x1b[37m',

    // Background styles
    blk_f : '\x1b[40m', // black
    kf    : '\x1b[40m',

    red_f : '\x1b[41m', // red
    rf    : '\x1b[41m',

    grn_f : '\x1b[42m', // green
    gf    : '\x1b[42m',

    yel_f : '\x1b[43m', // yellow
    yf    : '\x1b[43m',

    blue_f: '\x1b[44m', // blue
    bf    : '\x1b[44m',

    prp_f : '\x1b[45m', // magenta
    mgt_f : '\x1b[45m', 
    mf    : '\x1b[45m',

    trq_f : '\x1b[46m', // cyan
    cf    : '\x1b[46m',

    wht_f : '\x1b[47m', // white
    wf    : '\x1b[47m',
}

// returns array of strings without color tags
export function decolorText(...text: Array<any>): string[] {
    let replacer: RegExp
    let res: string[] = []
    let txt: string
    for (let i = 0; i < text.length; i++) {
        txt = text[i].toString()
        for (let k in styles) {
            replacer = new RegExp(`<${k}>`, "g")
            txt = txt.replace(replacer, "")  
        }
        res.push(txt)
    }
    return res 
}

// returns array of strings with color keys as in styles
export function colorText(...text: Array<any>): string[] {
    let replacer: RegExp
    let res: string[] = []
    let txt: string
    for (let i = 0; i < text.length; i++) {
        txt = text[i].toString()
        for (let k in styles) {
            replacer = new RegExp(`<${k}>`, "g")
            txt = txt.replace(replacer, styles[k])  
        }  
        txt = txt + styles["clr"]
        res.push(txt)
    }
    return res 
}

// prints color strings to console, returns decolored array of strings
export function log(...text: Array<any>): string[] {
    console.log(...colorText(...text))
    return decolorText(...text)
}



