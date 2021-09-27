const routes = require('express').Router()
const {createHash} = require('crypto');
const conn = require('../sql/conn');
/**
 * 1. CRIAÇÃO DE ENDEREÇOS
 * 2. CRIAÇÃO DE DESCONTOS
 */
routes.get('/login/:user/:password', (req, res)=>{

    const {user, password} = req.params;
    const querySql = "SELECT DELI_PASSWORD, DELI_ACTIVE FROM DELI_ACCOUNT WHERE DELI_USERNAME = ?";

    conn.query(querySql, [user], (error, results, fields)=>{
        const passMD5 = createHash('md5');
        passMD5.update(password)
        if(results[0].DELI_PASSWORD == passMD5.digest('hex') && results[0].DELI_ACTIVE != 'N'){
            res.json({"status": true})
            return;
        }
        res.json({"status": false})
    })

})
/**
 * GET
 */
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
// GET ITEMS MENU
routes.get('/menu-items/:category_hash', (req, res)=>{

    const {category_hash} = req.params;

    const querySql = "SELECT SK.DELI_TITLE, SK.DELI_DESCRIPTION, SK.DELI_PRICE, SK.DELI_HASH AS HASH_SKU FROM deli_sku AS SK "+
    "INNER JOIN deli_category AS CT ON (CT.DELI_ID_CATEGORY = SK.DELI_ID_CATEGORY) "+
    "WHERE CT.DELI_HASH = ? AND SK.DELI_ACTIVE != 'N'";
    
    conn.query(querySql, [category_hash], (error, results, fields)=>{
        if(!results){
            res.json({"error":"empty"});
            return;
        }
        res.json(results)
    })

})
// GET ITEMS MENU
/**
 * FIM GET
 */
/**
 * SET
 */
// SET MENU
routes.post('/menu-add', (req, res)=>{
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
// SET MENU
// SET SUBMENU
routes.post('/menu-submenu-add', (req, res)=>{
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
       
        const insertItem = (error, results, fields) => {
            if(error){ throw error}
            
            const querySql = "INSERT INTO DELI_CATEGORY (DELI_TITLE, DELI_DESCRIPTION, DELI_ID_DEPARTMENT, DELI_ID_DISCOUNT_SKU, DELI_DT_CREATED) "+
            "VALUES(?, ?, ?, ?, ?)";

            const sqlValues = [deli_title, deli_desc, results[0].DELI_ID_DEPARTMENT];
            
            sqlValues.push(dataBody.deli_id_discount || null)
            sqlValues.push(new Date().toISOString())
            
            conn.query(querySql, sqlValues,(error, results, fields)=>{
                if(error){ throw error}
            })
            conn.commit()
        }

        conn.query('SELECT DELI_ID_DEPARTMENT FROM DELI_DEPARTMENT WHERE DELI_HASH = ?', [deli_hash_department], insertItem)
       
        res.json({"status":"success"});
        return
    } catch (err) {
        console.log(err)
        conn.rollback()
        return
    }
    

})
// SET SUBMENU
// SET SUBMENU ITEMS
routes.post('/menu-submenu-items-add', (req, res)=>{
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

        const insertItem = (error, results, fields) => {
            const sqlValues = [deli_title, deli_desc, deli_price];
    
            sqlValues.push(dataBody.deli_id_discount || null)
            sqlValues.push(results[0].DELI_ID_CATEGORY)
            sqlValues.push(new Date().toISOString())
            
            const querySql = "INSERT INTO DELI_SKU (DELI_TITLE, DELI_DESCRIPTION, DELI_PRICE, DELI_ID_DISCOUNT_SKU, DELI_ID_CATEGORY, DELI_DT_CREATED) "+
            "VALUES(?, ?, ?, ?, ?, ?)";
            
            conn.query(querySql, sqlValues,(error, results, fields)=>{
                if(error){ throw error}
                res.json({"status":"success"});
            }) 
            conn.commit()
        }
        
        conn.query('SELECT DELI_ID_CATEGORY FROM DELI_CATEGORY WHERE DELI_HASH = ?', [deli_hash_category], insertItem)

    } catch (err) {
        console.log(err)
        res.json({"error":err})
        conn.rollback()
        return
    }
})
// SET SUBMENU ITEMS
// SET ORDER
routes.post('/create-order',(req, res)=>{
  
    // afeter insert velue, return 'insertId' from query
    try {
        const order = req.body;
        const hash_user = order.user;
        const getSKU = (hash_order, data, cb) => {
            let itemsSku = {
                "order":hash_order,
                "items":[]
            }
            let itemPending = data.length;
            data.forEach((items) => {
                conn.query('SELECT * FROM DELI_SKU WHERE DELI_HASH = ? ', [items.hash_sku], (error, results)=>{
                    results[0].qtd = items.qtd;
                    results[0].description = items.description;
                    itemsSku.items.push(results[0]);
                    if(0 === --itemPending){
                        cb(itemsSku)
                    }
                })
            });
        }
        const insertItemsOrder = (data)=>{
            //const hashOrder = results[0].DELI_HASH;
            const queryInsertItems = "INSERT INTO DELI_ORDER_ITEMS (DELI_HASH_ORDER, DELI_DESCRIPTION, DELI_HASH_SKU, DELI_QUANTITY_SKU, DELI_PRICE, DELI_PRICE_AMOUNT) "+
                                " VALUES(?, ?, ?, ?, ?, ?)";
            data.items.forEach((items)=>{
                console.log(items)
                let priceAmount = items.qtd * items.DELI_PRICE;
                let itemsOrder = [data.order, items.description, items.DELI_HASH, items.qtd, items.DELI_PRICE, priceAmount]
                //itemsOrder.push(items.hash_discount || null);
                conn.query(queryInsertItems, itemsOrder, (error, results, fields)=>{
                    if(error) throw error;
                    console.log(results);
                })
                conn.commit();
             })
             res.json({"status":"ok", "hash_order":data.order});

        }
        const createOrder = (error, results, fields)=>{
            if(error) throw error;
            conn.query('SELECT DELI_HASH FROM DELI_ORDER WHERE DELI_ID_ORDER = ?',[results.insertId], (error, results, fields)=>{
                console.log(results[0])
                getSKU(results[0].DELI_HASH, order.items, insertItemsOrder)                
            })
        }

        const dateNow = new Date().toISOString()
        const objOrder = [hash_user, dateNow]

        conn.query('INSERT INTO DELI_ORDER (DELI_HASH_USER, DELI_DT_CREATED) VALUES(?, ?)', objOrder, createOrder)

    } catch (error) {
        console.log(error);
        conn.rollback()
    }
   
})
// SET ORDER
/**
 * FIM SET
 */
module.exports = routes;