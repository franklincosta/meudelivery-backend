const routes = require('express').Router()
const { throws } = require('assert');
const { triggerAsyncId } = require('async_hooks');
const {createHash} = require('crypto');
const { CONNREFUSED } = require('dns');
const conn = require('../sql/conn');
/**
 * GET
 */
// GET LOGIN
routes.get('/login/:user/:password', (req, res)=>{
    try {
        const {user, password} = req.params;
        const querySql = "SELECT DELI_PASSWORD, DELI_ACTIVE FROM DELI_ACCOUNT WHERE DELI_USERLOGIN = ?";
    
        conn.query(querySql, [user], (error, results, fields)=>{
            const passMD5 = createHash('md5');
            passMD5.update(password)
            if(results[0].DELI_PASSWORD == passMD5.digest('hex') && results[0].DELI_ACTIVE != 'N'){
                res.json({"status": true})
                return;
            }
            res.json({"status": false})
        })
    } catch (error) {
        console.log(error);
        conn.rollback()
    }
    
})
// GET LOGIN
// GET ACCOUNT INFO
routes.post('/user', (req, res)=>{
    const user = req.body;

    try {

        if(!user.hash_user){
            res.json({"error":"user.hash.missing"})
            return;
        }
        const querySql = "SELECT * FROM DELI_ACCOUNT WHERE DELI_HASH = ?";

        const userInfos = {
            "user":[],
            "address":[]
        }
        conn.query(querySql, [user.hash_user], (error, results, fields)=>{
            if(error) throw error;
            userInfos.user.push(results)
            const queryAddress = "SELECT * FROM deli_address AS A "+
            "LEFT JOIN deli_account_address AD ON (AD.DELI_HASH_ADDRESS = A.DELI_HASH) "+
            "LEFT JOIN deli_account AS AC ON (AC.DELI_HASH = AD.DELI_HASH_ACCOUNT) "+
            "WHERE AC.DELI_HASH = ?"

            conn.query(queryAddress,user.hash_user,(error, data)=>{
                if(error) throw error;
                userInfos.address.push(data)
                res.json(userInfos)
            })
        }) 

    } catch (error) {
        console.log(error);
        conn.rollback()
    }

  

})
// GET ACCOUNT INFO
routes.post('/user-master', (req, res)=>{
    const user_master = req.body;

    try {
        if(!user_master.hash_user){
            res.json({"error":"user_master.hash.missing"})
            return;
        }
        const querySql = "SELECT * FROM DELI_ACCOUNT_MASTER WHERE DELI_HASH = ?";

        conn.query(querySql, [user_master.hash_user], (error, results, fields)=>{
            if(error) throw error;
            res.json(results)
        }) 

    } catch (error) {
        console.log(error);
        conn.rollback()
    }

  

})
// GET ACCOUNT INFO
// GET MENU
routes.get('/menu', (req, res)=>{

    const querySql = "SELECT DELI_TITLE, DELI_DESCRIPTION FROM DELI_DEPARTMENT WHERE DELI_ACTIVE != 'N'";

    conn.query(querySql, (error, results, fields)=>{
        if(!results){
            res.json({"error":"empty"});
            return;
        }
        res.json(results)
    })

})
// GET MENU
// GET SUBMENU
routes.get('/menu-submenu', (req, res)=>{

    const querySql = "SELECT DELI_TITLE, DELI_DESCRIPTION FROM DELI_CATEGORY WHERE DELI_ACTIVE != 'N'";

    conn.query(querySql, (error, results, fields)=>{
        if(!results){
            res.json({"error":"empty"});
            return;
        }
        res.json(results)
    })

})
// GET SUBMENU
// GET ITEMS MENU
routes.get('/menu-submenu-items/', (req, res)=>{

    const querySql = "SELECT SK.DELI_ID_SKU, SK.DELI_TITLE AS DELI_SKU_TITLE, SK.DELI_DESCRIPTION, SK.DELI_PRICE, SK.DELI_HASH AS HASH_SKU, "+
    "D.DELI_ID_DISCOUNT as DELI_SKU_ID_DISCOUNT, D.DELI_AMOUNT AS DELI_SKU_AMOUNT_DISCOUNT, CT.DELI_TITLE AS DELI_TITLE_CATEGORY FROM DELI_SKU AS SK "+
    "INNER JOIN deli_category AS CT ON (CT.DELI_ID_CATEGORY = SK.DELI_ID_CATEGORY) "+
    "INNER JOIN deli_discount AS D ON (D.DELI_ID_DISCOUNT = SK.DELI_ID_DISCOUNT) "+
    "WHERE SK.DELI_ACTIVE != 'N'";
    
    conn.query(querySql, (error, row, fields)=>{
        if(error) throw error;
        if(!row) res.json({"error":"empty"})
        let objItems = row.reduce(function(results, items) {
            items.DELI_FINAL_PRICE = (items.DELI_SKU_ID_DISCOUNT != null) ? items.DELI_PRICE - ((items.DELI_SKU_AMOUNT_DISCOUNT / 100) * items.DELI_PRICE) : items.DELI_PRICE;

            (results[items.DELI_TITLE_CATEGORY] = results[items.DELI_TITLE_CATEGORY] || []).push(items);
            return results;
        }, {})

        conn.commit()
        res.json(objItems)
    })

})
// GET ITEMS MENU
//GET ORDER
routes.get('/order/:hash_user/:hash_order',(req, res)=>{
    try {
        const {hash_user, hash_order } = req.params;

        const sqlOrder = "SELECT O.DELI_ID_ORDER, S.DELI_TITLE, OI.DELI_PRICE, OI.DELI_QUANTITY_SKU FROM DELI_ACCOUNT A "+
                        "LEFT JOIN DELI_ORDER O ON (O.DELI_HASH_USER = A.DELI_HASH) "+
                        "LEFT JOIN DELI_ORDER_ITEMS OI ON(OI.DELI_HASH_ORDER = O.DELI_HASH) "+
                        "LEFT JOIN DELI_SKU S ON (S.DELI_HASH = OI.DELI_HASH_SKU) "+
                        "WHERE A.DELI_HASH = ? AND O.DELI_HASH = ?";
        conn.query(sqlOrder,[hash_user, hash_order], (err, row) =>{
            if(err) throw err;
            conn.commit()
            res.json(row);
        })
    } catch (error) {
        console.log(error);
        conn.rollback()
    }
})
//GET ORDER
//GET DISCOUNT
routes.get('/discount', (req, res)=>{
    const {discount_hash} = req.body;
    try {
        if(!discount_hash){
            res.json({"error":"discount.hash.missing"});
            return;
        }

        const slqDiscount = "SELECT DELI_TITLE, DELI_AMOUNT FROM DELI_DISCOUNT WHERE DELI_HASH = ?"

        conn.query(slqDiscount, [discount_hash], (err, row)=>{
            if(err) throw err;
            res.json(row[0]);
        })
    } catch (error) {
        conn.commit();
        throw error;
    }
})
//GET DISCOUNT

/**
 * FIM GET
 */
/**
 * CREATE
 */
// CREATE MENU
routes.post('/menu-create', (req, res)=>{
    conn.beginTransaction()
    const dataBody = req.body;
    try {
        
        if(!dataBody.deli_title){
            res.json({"error":"deli.title.missing"})
            return;
        }
        if(!dataBody.deli_desc){
            res.json({"error":"deli.description.missing"})
            return;
        }
       
        const {deli_title, deli_desc} = dataBody;
        const sqlValues = [deli_title, deli_desc];

        sqlValues.push(dataBody.deli_id_discount || null)
        sqlValues.push(new Date().toISOString())
        
        const querySql = "INSERT INTO DELI_DEPARTMENT (DELI_TITLE, DELI_DESCRIPTION, DELI_ID_DISCOUNT, DELI_DT_CREATED) "+
        "VALUES(?, ?, ?, ?)";
        
        conn.query(querySql, sqlValues,(error, results, fields)=>{
            if(error){ throw error}
        }) 
        conn.commit()

        res.json({"status":"success"});
        return
    } catch (err) {
        res.json({"error":err})
        conn.rollback()
        return
    }

})
// CREATE MENU
// CREATE SUBMENU
routes.post('/menu-create-submenu', (req, res)=>{
    conn.beginTransaction()
    const dataBody = req.body;
    try {
        
        if(!dataBody.deli_title){
            res.json({"error":"deli.title.missing"})
            return;
        }
        if(!dataBody.deli_desc){
            res.json({"error":"deli.description.missing"})
            return;
        }

        if(!dataBody.deli_hash_department){
            res.json({"error":"deli.department.missing"})
            return;
        }

        const {deli_title, deli_desc, deli_hash_department} = dataBody;
       
        const insertItem = (error, row, fields) => {
            if(error){ throw error}
            if(!row) res.json({"error":"deli.department.notfound"})
            
            const querySql = "INSERT INTO DELI_CATEGORY (DELI_TITLE, DELI_DESCRIPTION, DELI_ID_DEPARTMENT, DELI_ID_DISCOUNT, DELI_DT_CREATED) "+
            "VALUES(?, ?, ?, ?, ?)";

            const sqlValues = [deli_title, deli_desc, row[0].DELI_ID_DEPARTMENT];
            
            sqlValues.push(dataBody.deli_id_discount || null)
            sqlValues.push(new Date().toISOString())
            
            conn.query(querySql, sqlValues,(error, results, fields)=>{
                if(error){ throw error}
            })
            conn.commit();
            res.json({"status":"success"});
        }

        conn.query('SELECT DELI_ID_DEPARTMENT FROM DELI_DEPARTMENT WHERE DELI_HASH = ?', [deli_hash_department], insertItem)
       
    } catch (err) {
        conn.rollback()
        throw error;
    }
    

})
// CREATE SUBMENU
// CREATE SUBMENU ITEMS
routes.post('/menu-create-submenu-items', (req, res)=>{
    conn.beginTransaction()
    const dataBody = req.body;
    try {
        
        if(!dataBody.deli_title){
            res.json({"error":"deli.title.missing"})
            return;
        }
        if(!dataBody.deli_desc){
            res.json({"error":"deli.description.missing"})
            return;
        }
        if(!dataBody.deli_price){
            res.json({"error":"deli.price.missing"})
            return;
        }
        if(!dataBody.deli_hash_category){
            res.json({"error":"deli.category.missing"})
            return;
        }
        const {deli_title, deli_desc, deli_price, deli_hash_category} = dataBody;

        const insertItem = (error, row, fields) => {
            if(!row) res.json({"error":"deli.category.notfounf"})
            const sqlValues = [deli_title, deli_desc, deli_price];
            const idCategory = row[0].DELI_ID_CATEGORY;
            conn.query('SELECT DELI_ID_DISCOUNT FROM DELI_DISCOUNT WHERE DELI_HASH = ?',[dataBody.deli_hash_discount], (err, row)=>{
                if(error){ throw error}
                const idDiscount = (row.length > 0) ? row[0].DELI_ID_DISCOUNT : null;
                sqlValues.push(idDiscount)
                sqlValues.push(idCategory)
                sqlValues.push(new Date().toISOString())
                
                const querySql = "INSERT INTO DELI_SKU (DELI_TITLE, DELI_DESCRIPTION, DELI_PRICE, DELI_ID_DISCOUNT, DELI_ID_CATEGORY, DELI_DT_CREATED) "+
                "VALUES(?, ?, ?, ?, ?, ?)";
                
                conn.query(querySql, sqlValues,(error, results, fields)=>{
                    if(error){ throw error}
                    res.json({"status":"success"});
                }) 
                conn.commit()
            })

        }
        
        conn.query('SELECT DELI_ID_CATEGORY FROM DELI_CATEGORY WHERE DELI_HASH = ?', [deli_hash_category], insertItem)

    } catch (err) {
        console.log(err)
        res.json({"error":err})
        conn.rollback()
        return
    }
})
// CREATE SUBMENU ITEMS
// CREATE ORDER
routes.post('/order-create',(req, res)=>{
    conn.beginTransaction()
    const order = req.body;
    const hash_user = order.user
    if(!hash_user){
        res.json({"error":"order.hash.missing"})
        return;
    }
    if(!order.items || order.items.length == 0){
        res.json({"error":"order.items.missing"})
        return;
    }
    
    // afeter insert velue, return 'insertId' from query
    try {
        const getSKU = (id_order, data, cb) => {
            let itemsSku = {
                "order":id_order,
                "items":[]
            }
            let itemPending = data.length;
            data.forEach((items) => {
                conn.query('SELECT * FROM DELI_SKU WHERE DELI_HASH = ? ', [items.hash_sku], (error, results)=>{
                    results[0].qtd = items.qtd;
                    itemsSku.items.push(results[0]);
                    if(0 === --itemPending){
                        cb(itemsSku)
                    }
                })
            });
        }
        const insertItemsOrder = (data)=>{
            //const hashOrder = results[0].DELI_HASH;
            const queryInsertItems = "INSERT INTO DELI_ORDER_ITEMS (DELI_ID_ORDER, DELI_ID_SKU, DELI_QUANTITY_SKU, DELI_PRICE, DELI_PRICE_AMOUNT) "+
                                " VALUES(?, ?, ?, ?, ?)";
            data.items.forEach((items)=>{
                let priceAmount = items.qtd * items.DELI_PRICE;
                let itemsOrder = [data.order, items.DELI_ID_SKU, items.qtd, items.DELI_PRICE, priceAmount]
                //itemsOrder.push(items.hash_discount || null);
                conn.query(queryInsertItems, itemsOrder, (error, results, fields)=>{
                    if(error) throw error;
                })
                conn.commit();
             })
             res.json({"status":"ok", "id_order":data.order});

        }
        const createOrder = (error, row, fields)=>{
            if(error) throw error;
            getSKU(row.insertId, order.items, insertItemsOrder)                
        }

        const dateNow = new Date().toISOString()
        conn.query('SELECT DELI_ID_ACCOUNT FROM DELI_ACCOUNT WHERE DELI_HASH_USER = ?',[hash_user], (err, row)=>{
            const objOrder = [row[0].DELI_ID_ACCOUNT, dateNow]
            conn.query('INSERT INTO DELI_ORDER (DELI_ID_USER, DELI_DT_CREATED) VALUES(?, ?)', objOrder, createOrder)
        })

    } catch (error) {
        console.log(error);
        conn.rollback()
    }
   
})
// CREATE ORDER
// CREATE USER
routes.post('/user-create', (req, res)=>{
    conn.beginTransaction()

    const user = req.body;
    try {
        if(!user.user_name){
            res.json({"error":"user.name.missing"})
            return;
        }
        if(!user.user_login){
            res.json({"error":"user.login.missing"})
            return;
        }
        if(!user.user_mail){
            res.json({"error":"user.mail.missing"})
            return;
        }
        if(!user.user_password){
            res.json({"error":"user.password.missing"})
            return;
        }
        
        const {user_name, user_login, user_mail, user_password} = user;
        const userInfos = [user_name, user_login, user_mail]

        const sqlCheck = "SELECT DELI_USERLOGIN, DELI_EMAIL FROM DELI_ACCOUNT WHERE DELI_USERLOGIN  = ? OR DELI_EMAIL = ?";

        conn.query(sqlCheck, [user_login, user_mail], (err, row) =>{
            if(!row && row[0].DELI_USERLOGIN == user_login){
                res.json({"error":"user.login.alreadyexists"})
                return;
            }
            if(!row && row[0].DELI_EMAIL == user_mail){
                res.json({"error":"user.mail.alreadyexists"})
                return;
            }
            
            const passMD5 = createHash('md5');
            passMD5.update(user_password.toString())
            
            const newPass = passMD5.digest('hex');
            userInfos.push(newPass);

            const newDate = new Date().toISOString()

            userInfos.push(newDate);

            conn.query('INSERT INTO DELI_ACCOUNT(DELI_USERNAME, DELI_USERLOGIN, DELI_EMAIL, DELI_PASSWORD, DELI_DT_CREATED) VALUES(?,?,?,?,?)',userInfos,(err, data, fields) => {
                if(err) throw err;
                conn.commit();
                res.json({"status":"ok"});
            });
        })
    } catch (error) {
        console.log(error);
        conn.rollback()
    }

})
// CREATE USER
// CREATE USER MASTER
routes.post('/user-master-create', (req, res)=>{
    conn.beginTransaction()

    const user = req.body;
    try {
        if(!user.user_name){
            res.json({"error":"user.name.missing"})
            return;
        }
        if(!user.user_login){
            res.json({"error":"user.login.missing"})
            return;
        }
        if(!user.user_mail){
            res.json({"error":"user.mail.missing"})
            return;
        }
        if(!user.user_password){
            res.json({"error":"user.password.missing"})
            return;
        }
     
        const {user_name, user_login, user_mail, user_password} = user;
        const userInfos = [user_name, user_login, user_mail]
        
        const sqlCheck = "SELECT DELI_USERLOGIN, DELI_EMAIL FROM DELI_ACCOUNT_MASTER WHERE DELI_USERLOGIN  = ? OR DELI_EMAIL = ?"

        conn.query(sqlCheck, [user_login, user_mail], (err, row) =>{
            if(!row && row[0].DELI_USERLOGIN == user_login){
                res.json({"error":"user.login.alreadyexists"})
                return;
            }
            if(!row && row[0].DELI_EMAIL == user_mail){
                res.json({"error":"user.mail.alreadyexists"})
                return;
            }

            const passMD5 = createHash('md5');
            passMD5.update(user_password.toString())
            
            const newPass = passMD5.digest('hex');
            userInfos.push(newPass);
    
            const newDate = new Date().toISOString()
    
            userInfos.push(newDate);
    
            conn.query('INSERT INTO DELI_ACCOUNT_MASTER(DELI_USERNAME, DELI_USERLOGIN, DELI_EMAIL, DELI_PASSWORD, DELI_DT_CREATED) VALUES(?,?,?,?,?)',userInfos,(err, data, fields) => {
    
                if(err) throw err;
                
                conn.commit();
    
                res.json({"status":"ok"});
    
            });
        })
    } catch (error) {
        conn.rollback()
    }

})
// CREATE USER MASTER
// CREATE USER ADDRESS
routes.post('/user-create-address', (req, res)=>{
    conn.beginTransaction()

    const user = req.body;
    try {
        if(!user.address_user){
            res.json({"error":"address.user.missing"})
            return;
        }
        if(!user.address_title){
            res.json({"error":"address.title.missing"})
            return;
        }
        if(!user.address_cep){
            res.json({"error":"address.cep.missing"})
            return;
        }
        if(!user.address_name_1){
            res.json({"error":"address.address_1.missing"})
            return;
        }
        if(!user.address_name_2){
            res.json({"error":"address.address_2.missing"})
            return;
        }
        if(!user.address_city){
            res.json({"error":"address.city.missing"})
            return;
        }
        if(!user.address_state){
            res.json({"error":"address.state.missing"})
            return;
        }
        if(!user.address_country){
            res.json({"error":"address.country.missing"})
            return;
        }
        const {address_user, address_title, address_cep, address_name_1,address_name_2,address_city,address_state,address_country} = user;
        const addressInfos = [address_title, address_cep, address_name_1,address_name_2,address_city,address_state,address_country]
        
        const newDate = new Date().toISOString()

        addressInfos.push(user.address_description || null);
        addressInfos.push(newDate);

        conn.query('INSERT INTO DELI_ADDRESS(DELI_TITLE, DELI_CEP, DELI_ADDRESS_1, DELI_ADDRESS_2, DELI_CITY,DELI_STATE, DELI_COUNTRY, DELI_DESCRIPTION, DELI_DT_CREATED) VALUES(?,?,?,?,?,?,?,?,?)', addressInfos, (err, row, fields) => {

            if(err) throw err;
            const idOrder = row.insertId;
            conn.query('SELECT DELI_ID_ACCOUNT FROM DELI_ACCOUNT WHERE DELI_HASH = ?',[address_user], (err,row)=>{
                if(err) throw err;
                
                const infoAddressAccount = [idOrder, row[0].DELI_ID_ACCOUNT]

                conn.query('INSERT INTO DELI_ACCOUNT_ADDRESS(DELI_ID_ADDRESS, DELI_ID_ACCOUNT) VALUES(?, ?)', infoAddressAccount, (err, row)=>{
                   
                    if(err) throw err;
                    conn.commit();
                    res.json({"status":"ok"});

                })
            })

        });

    } catch (error) {
        console.log(error);
        conn.rollback()
    }

})
// CREATE USER ADDRESS
// CREATE DISCOUNT
routes.post('/discount-create', (req, res)=>{
    conn.beginTransaction()

    try {
        const {discount_title, discount_amount} = req.body;

        if(!discount_title){
            res.json({"error":"discount.title.missing"})
            return;
        }
        if(!discount_amount){
            res.json({"error":"discount.amount.missing"})
            return;
        }
        
        const slqDiscount = "INSERT INTO DELI_DISCOUNT (DELI_TITLE, DELI_AMOUNT) VALUES(?,?)";

        conn.query(slqDiscount,[discount_title, discount_amount],(err, row) =>{
            if(err) throw err
            conn.commit();
            res.json({"status":"ok"})
        })
    } catch (error) {
        conn.rollback()
        throw error;
    }
})
// CREATE DISCOUNT
/**
 * FIM CREATE
 */
module.exports = routes;