const passport = require('passport');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

const {Strategy: LocalStrategy} = require('passport-local');

module.exports = () => {
    passport.use(new LocalStrategy({
        usernameField: 'username', //req.body.username
        passwordField: 'password', //req.body.password
        passReqToCallback: false
    }, async (_username, password, done) => { //username은 실제로 사용 x
        try {
            if (!process.env.PASSWORD) {
                throw new Error('NO process.env.PASSWORD');
            }

            const rawHash = String(process.env.PASSWORD).trim();
            const normalizedHash = rawHash
                .replace(/^"|"$/g, '')
                .replace(/^'|'$/g, '')
                .replace(/^\$2y\$/, '$2b$');

            const result = await bcrypt.compare(String(password), normalizedHash);
            if (result) {
                done(null, {username: 'admin'}); //user.username = 'admin'
            } else {
                done(null, false, {message: '비밀번호가 틀림'});
            }
        } catch (error) {
            console.log(error);
            done(error);
        }
    }));
};
