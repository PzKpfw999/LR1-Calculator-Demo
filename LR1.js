class Token {
    constructor(type, content, line, column) {
        this.type = type;
        this.content = content;
        this.line = line;
        this.column = column;
    }
}
class Lexer {
    constructor(inputStr, callback) {
        this.tokens = new Array();
        this.callback = null;
        if (callback) {
            this.callback = callback;
        }
        let state = 0;
        let pointer = 0, lineCounter = 0, columnCounter = 0;
        let concat = "";
        function IsAlphaNumberic(character) {
            if (!character)
                return null;
            let code = character.charCodeAt(0);
            return code >= 65 && code <= 90 ||
                code >= 97 && code <= 122 ||
                code >= 48 && code <= 57;
        }
        ;
        function IsNumberic(character) {
            if (!character)
                return null;
            let code = character.charCodeAt(0);
            return code >= 48 && code <= 57;
        }
        function IsAlpha(character) {
            if (!character)
                return null;
            let code = character.charCodeAt(0);
            return code >= 65 && code <= 90 || code >= 97 && code <= 122;
        }
        let Automaton = function (c) {
            switch (state) {
                case 0:
                    switch (c) {
                        case "+":
                        case "-":
                        case "*":
                        case "/":
                        case "(":
                        case ")":
                        case "^":
                            this.PushToken(c, c, lineCounter, ++columnCounter);
                            break;
                        case " ":
                        case "\t":
                            columnCounter++;
                            break;
                        case "\n":
                            columnCounter = 0;
                            lineCounter++;
                            break;
                        case "\0":
                            break;
                        default:
                            concat = "";
                            columnCounter++;
                            if (IsAlpha(c)) {
                                concat += c;
                                state = 1;
                            }
                            else if (IsNumberic(c)) {
                                concat += c;
                                state = 2;
                            }
                            else {
                                if (lineCounter == 0) {
                                    throw `Lexical error : unknow character "${c}" at position: ${columnCounter}`;
                                }
                                else {
                                    throw `Lexical error : unknow character "${c}" at position: ${lineCounter}:${columnCounter}`;
                                }
                            }
                            break;
                    }
                    pointer++;
                    break;
                case 1: //id
                    if (c == "\0") {
                        this.PushToken("id", concat, lineCounter, columnCounter);
                    }
                    else if (IsAlphaNumberic(c)) {
                        concat += c;
                        pointer++;
                        columnCounter++;
                    }
                    else {
                        this.PushToken("id", concat, lineCounter, columnCounter);
                        state = 0;
                    }
                    break;
                case 2: //int
                    if (c == "\0") {
                        this.PushToken("int", concat, lineCounter, columnCounter);
                    }
                    else if (IsNumberic(c)) {
                        concat += c;
                        pointer++;
                        columnCounter++;
                    }
                    else if (c == ".") {
                        concat += c;
                        pointer++;
                        columnCounter++;
                        state = 3;
                    }
                    else {
                        this.PushToken("int", concat, lineCounter, columnCounter);
                        state = 0;
                    }
                    break;
                case 3: //float
                    if (c == "\0") {
                        this.PushToken("float", concat, lineCounter, columnCounter);
                    }
                    else if (IsNumberic(c)) {
                        concat += c;
                        pointer++;
                        columnCounter++;
                    }
                    else {
                        this.PushToken("float", concat, lineCounter, columnCounter);
                        state = 0;
                    }
                    break;
            }
        }.bind(this);
        while (pointer < inputStr.length) {
            let c = inputStr[pointer];
            Automaton(c);
        }
        Automaton("\0");
        this.tokens.push(new Token("$", "EOF", lineCounter, columnCounter));
    }
    PushToken(type, content, line, column) {
        let token = new Token(type, content, line, column);
        this.tokens.push(token);
        if (this.callback) {
            this.callback(token);
        }
    }
}
class LR1Item {
    // e.g. A = .aBc (left=A, right=aBc, dot = 0)
    //covertable assign each symbol a unique number to generate hashcode for comparison
    //must contain the vaild mapping (will not check)!
    constructor(left, right, dotPosition, lookahead, covertTableRef) {
        if (!LR1Item.covertTableRef) {
            if (!covertTableRef)
                throw "Must provide covertable reference at first instantiation!";
            else
                LR1Item.covertTableRef = covertTableRef;
        }
        this.left = left;
        this.right = right;
        this.dotPosition = dotPosition;
        this.lookahead = lookahead;
        this.CalcHashCode();
    }
    CalcHashCode() {
        let tmp = new Uint16Array(3 + this.right.length);
        tmp[0] = LR1Item.covertTableRef.get(this.left);
        tmp[1] = this.dotPosition;
        tmp[2] = LR1Item.covertTableRef.get(this.lookahead);
        for (let i = 3; i < tmp.length; i++) {
            tmp[i] = LR1Item.covertTableRef.get(this.right[i - 3]);
        }
        let hashl = 0x892de1b1;
        let hashh = 0xae0a5af3;
        for (let c of tmp) {
            hashl = Math.imul(c ^ hashl, 0xba7f460b);
            hashh = Math.imul(c ^ hashh, 0x3df90f25);
            hashl ^= (hashh << 13);
            hashh ^= (hashl >> 17);
        }
        this.hashCode = hashl + (hashh & 0x1fffff) * 0x100000000;
    }
    AfterDot() {
        if (this.dotPosition < this.right.length) {
            return this.right[this.dotPosition];
        }
        return null;
    }
    AfterAfterDotAll() {
        let concat = [];
        for (let i = this.dotPosition + 1; i < this.right.length; i++) {
            concat.push(this.right[i]);
        }
        concat.push(this.lookahead);
        return concat;
    }
    Clone() {
        let tmp = new LR1Item(this.left, this.right, this.dotPosition, this.lookahead);
        tmp.hashCode = this.hashCode;
        return tmp;
    }
    Equal(item) {
        return item.hashCode == this.hashCode;
    }
    ToString() {
        let str = this.left + "=";
        for (let i = 0; i < this.right.length; i++) {
            if (i == this.dotPosition)
                str += ".";
            str += this.right[i];
        }
        str += "," + this.lookahead;
        return str;
    }
}
class LR1State {
    constructor(state, items) {
        this.state = state;
        this.items = new Array(items.length);
        for (let i in items) {
            this.items[i] = items[i];
        }
    }
    Push(item) {
        for (let each of this.items) {
            if (item.Equal(each))
                return;
        }
        this.items.push(item);
    }
    Get(index) {
        if (index >= 0 && index < this.items.length) {
            return this.items[index];
        }
        return null;
    }
    get length() { return this.items.length; }
    get HashCode() { return this.hashCode; }
    CalcHashCode() {
        let hashl = 0;
        let hashh = 0;
        for (let item of this.items) {
            if (hashl == 0 && hashh == 0) {
                hashl = item.hashCode & 0xffffffff;
                hashh = item.hashCode / 0x100000000;
            }
            else {
                hashl ^= item.hashCode & 0xffffffff;
                hashh ^= item.hashCode / 0x100000000;
            }
        }
        this.hashCode = hashl + hashh * 0x100000000;
    }
    Equal(items) {
        return items.hashCode == this.hashCode;
    }
    SlowEqual(items) {
        if (items.length == this.items.length) {
            for (let i = 0; i < items.length; i++) {
                let found = false;
                for (let j = 0; j < this.items.length; j++) {
                    if (items.Get(i).Equal(this.items[j])) {
                        found = true;
                        break;
                    }
                }
                if (!found)
                    return false;
            }
            return true;
        }
        return false;
    }
}
class LR1Parser {
    constructor(productions, startSymbol) {
        this.callback = null;
        this.firstSet = new Map();
        this.T = new Set(); //terminals
        this.N = new Set(); //non terminals
        this.A = new Map(); //assign all symbol type a number
        this.firstSetStack = new Set(); //to prevent recursive;
        if (productions === undefined || startSymbol === undefined) {
            productions = new Map();
            productions.set("S", [["sum"]]);
            productions.set("sum", [["-", "sum"], ["sum", "+", "product"], ["sum", "-", "product"], ["product"]]); // + -
            productions.set("product", [["product", "*", "power"], ["product", "/", "power"], ["power"]]); // * /
            productions.set("power", [["paren", "^", "power"], ["paren"]]);
            productions.set("paren", [["(", "sum", ")"], ["id", "(", "sum", ")"], ["number"]]); // () function() number
            productions.set("number", [["int"], ["float"]]);
            startSymbol = "S";
        }
        this.productions = productions;
        this.startSymbol = startSymbol;
        let counter = 0;
        for (let i of this.productions.keys()) {
            this.N.add(i);
            this.A.set(i, counter++);
        }
        for (let i of this.productions.keys()) {
            for (let j of this.productions.get(i)) {
                for (let k of j) {
                    if (!this.N.has(k)) {
                        this.T.add(k);
                        this.A.set(k, counter++);
                    }
                }
            }
        }
        this.T.add("$");
        this.A.set("$", counter);
        if (!this.A.has(startSymbol)) {
            throw "Start Symbol not in the production";
        }
        this.CalcParsingTable(new LR1State(0, [new LR1Item(startSymbol, productions.get(startSymbol)[0], 0, "$", this.A)]));
    }
    GetFirstSet(symbol) {
        if (!this.firstSet.has(symbol)) {
            if (this.firstSetStack.has(symbol))
                return new Set();
            else
                this.firstSetStack.add(symbol);
            var tmp = new Set();
            //terminal
            if (this.T.has(symbol)) {
                tmp.add(symbol);
            }
            else {
                //for non-terminal
                for (let production of this.productions.get(symbol)) {
                    for (let i = 0; i < production.length; i++) {
                        let tmpFirstSet = this.GetFirstSet(production[i]);
                        for (let j of tmpFirstSet.values()) {
                            // unless the symbol is the last, do not add Є in to the first set
                            if (j != "e" || i == production.length - 1)
                                tmp.add(j);
                        }
                        if (!tmpFirstSet.has("e"))
                            break; // if symbol don't has Є then no need to get the next symbol
                    }
                }
            }
            this.firstSet.set(symbol, tmp);
            this.firstSetStack.delete(symbol);
        }
        return this.firstSet.get(symbol);
    }
    GetFirstSetofSequence(symbolSequence) {
        let tmp = new Set();
        for (let i = 0; i < symbolSequence.length; i++) {
            let tmpFirstSet = this.GetFirstSet(symbolSequence[i]);
            for (let j of tmpFirstSet.values()) {
                if (j != "e" || i == symbolSequence.length - 1)
                    tmp.add(j);
            }
            if (!tmpFirstSet.has("e"))
                break;
        }
        return tmp;
    }
    Closure(items) {
        for (let i = 0; i < items.length; i++) {
            let item = items.Get(i);
            let nSymbol = item.AfterDot(); // non-terminal symbol
            if (nSymbol && this.N.has(nSymbol)) {
                for (let production of this.productions.get(nSymbol)) {
                    for (let lookahead of this.GetFirstSetofSequence(item.AfterAfterDotAll())) {
                        items.Push(new LR1Item(nSymbol, production, 0, lookahead, this.A));
                    }
                }
            }
        }
        items.CalcHashCode();
        return items;
    }
    Goto(items, symbol) {
        let tmpSet = new LR1State(-1, []);
        for (let i = 0; i < items.length; i++) {
            let item = items.Get(i);
            if (symbol == item.AfterDot()) {
                let tmp = item.Clone();
                tmp.dotPosition += 1;
                tmp.CalcHashCode();
                tmpSet.Push(tmp);
            }
        }
        if (tmpSet.length > 0) {
            return this.Closure(tmpSet);
        }
        return null;
    }
    CalcParsingTable(initState) {
        let table = new Map();
        let state = 1;
        let C = [this.Closure(initState)];
        for (let i = 0; i < C.length; i++) {
            for (let eachSymbol of this.A.keys()) {
                let tmpSet = this.Goto(C[i], eachSymbol);
                if (tmpSet) {
                    let index = -1;
                    for (let j = 0; j < C.length; j++) {
                        if (C[j].Equal(tmpSet)) {
                            index = j;
                            break;
                        }
                    }
                    if (index == -1) { // not in C
                        tmpSet.state = state;
                        table.set(C[i].state + ":" + eachSymbol, state + "");
                        state++;
                        C.push(tmpSet);
                    }
                    else {
                        table.set(C[i].state + ":" + eachSymbol, C[index].state + "");
                    }
                }
            }
        }
        let actionTable = new Map();
        for (let eachState of C) {
            for (let item of eachState.items) {
                let afterDot = item.AfterDot();
                if (item.left == this.startSymbol && !afterDot) {
                    actionTable.set(eachState.state + ":$", "Accept");
                }
                else {
                    if (!afterDot) {
                        actionTable.set(eachState.state + ":" + item.lookahead, "reduce " + item.left + " " + item.dotPosition + " " + item.ToString());
                    }
                    else if (this.T.has(afterDot)) {
                        actionTable.set(eachState.state + ":" + afterDot, "shift " + table.get(eachState.state + ":" + afterDot));
                    }
                }
            }
        }
        let gotoTable = new Map();
        for (let eachState of C) {
            for (let symbol of this.N.values()) {
                let key = eachState.state + ":" + symbol;
                if (table.has(key)) {
                    gotoTable.set(key, table.get(key));
                }
            }
        }
        for (let each of gotoTable) {
            actionTable.set(each[0], each[1]);
        }
        this.parsingTable = actionTable;
    }
    Parse(tokens) {
        let parseStack = [];
        let state = "0";
        let index = 0;
        function PrintStack() {
            let str = [];
            for (let each of parseStack) {
                str.push(each.ASTNode.token.type);
            }
            return str.join(",");
        }
        while (true) {
            let token = tokens[index];
            let action = this.parsingTable.get(state + ":" + token.type);
            if (!action) {
                throw `Syntax Error: Unexpected character: ${token.content}, DENY at postion: ${token.line}:${token.column}`;
            }
            let actions = action.split(" ");
            if (actions[0] == "shift") {
                state = actions[1];
                parseStack.push({ ASTNode: new ASTNode(null, token), state: state });
                index++;
                if (this.callback) {
                    this.callback("Shift: " + PrintStack());
                }
            }
            else if (actions[0] == "reduce") {
                let tmp = new Array(parseInt(actions[2]));
                for (let i = 0; i < parseInt(actions[2]); i++) {
                    tmp[tmp.length - 1 - i] = parseStack.pop().ASTNode;
                }
                if (parseStack.length == 0) {
                    state = "0";
                }
                else {
                    state = parseStack[parseStack.length - 1].state;
                }
                ;
                state = this.parsingTable.get(state + ":" + actions[1]);
                if (!state) {
                    throw `Syntax Error: Expected ${actions[3][actions[3].length - 1]}. DENY.`;
                    break;
                }
                parseStack.push({ ASTNode: new ASTNode(tmp, new Token(actions[1], "", tmp[0].token.line, tmp[0].token.column)), state: state });
                if (this.callback) {
                    this.callback("Reduce: " + PrintStack());
                }
            }
            else if (actions[0] == "Accept") {
                if (this.callback) {
                    this.callback("ACCEPT");
                }
                return parseStack[0].ASTNode;
            }
        }
    }
    GetProductions() {
        let tmp = [];
        let str = "";
        for (let i of this.productions) {
            for (let j of i[1]) {
                str = `<${i[0]}> = `;
                for (let k of j) {
                    if (this.N.has(k))
                        str += `<${k}>`;
                    else
                        str += ` ${k} `;
                }
                tmp.push(str);
            }
        }
        return tmp.join("\n");
    }
}
class ASTNode {
    constructor(chilren, token) {
        this.chilren = chilren;
        this.token = token;
    }
    get type() { return this.token.type; }
    get content() { return this.token.content; }
    GetResult() {
        switch (this.token.type) {
            case "paren":
                if (this.chilren.length == 1)
                    return this.chilren[0].GetResult();
                else if (this.chilren[0].token.type == "(")
                    return this.chilren[1].GetResult();
                else if (this.chilren[0].type == "id") {
                    let res;
                    try {
                        res = Math[this.chilren[0].content](this.chilren[2].GetResult());
                        return res;
                    }
                    catch (_a) {
                        throw `Semantic Error: Function ${this.chilren[0].content} not exist!`;
                    }
                }
            case "sum":
                if (this.chilren.length == 1)
                    return this.chilren[0].GetResult();
                else if (this.chilren[0].type == "-") {
                    return -this.chilren[1].GetResult();
                }
                else if (this.chilren[1].token.type == "+") {
                    return this.chilren[0].GetResult() + this.chilren[2].GetResult();
                }
                else {
                    return this.chilren[0].GetResult() - this.chilren[2].GetResult();
                }
            case "product":
                if (this.chilren.length == 1)
                    return this.chilren[0].GetResult();
                else if (this.chilren[1].token.type == "*") {
                    return this.chilren[0].GetResult() * this.chilren[2].GetResult();
                }
                else {
                    return this.chilren[0].GetResult() / this.chilren[2].GetResult();
                }
            case "power":
                if (this.chilren.length == 1)
                    return this.chilren[0].GetResult();
                else if (this.chilren[1].token.type == "^") {
                    return Math.pow(this.chilren[0].GetResult(), this.chilren[2].GetResult());
                }
            case "number":
                return this.chilren[0].GetResult();
            case "float":
                return parseFloat(this.token.content);
            case "int":
                return parseInt(this.token.content);
            default:
                return null;
        }
    }
    ShowSteps(callback) {
        if (!this.chilren) {
            return this.content;
        }
        if (this.chilren.length > 1) {
            let tmp = [];
            for (let each of this.chilren) {
                tmp.push(each.ShowSteps(callback));
            }
            tmp = tmp.join("");
            if (callback) {
                callback({ expersion: tmp, result: this.GetResult() });
            }
            return tmp;
        }
        else {
            return this.chilren[0].ShowSteps(callback);
        }
    }
}