"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const invoiceRoute_1 = __importDefault(require("./routes/invoiceRoute"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8000;
const DOMAIN = process.env.DOMAIN || 'http://localhost';
const rootDir = process.cwd();
app.set('view engine', 'ejs');
app.use(express_1.default.static(path_1.default.join(rootDir, 'public')));
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.json());
app.get('/', (req, res) => {
    res.render('index');
});
app.use('/pdf', invoiceRoute_1.default);
app.listen(PORT, () => {
    console.log(`Server is running on ${DOMAIN}:${PORT}`);
});
