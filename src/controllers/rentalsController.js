import { db } from "../database.connection.js";
import { createRentalSchema } from "../schemas/rentalsSchema.js";

export async function getRentals(req,res){
    try{
        const rentals = await db.query('select * from rentals');
        res.send(rentals.rows)
    }catch(err){
        res.status(500).send(err.message)
    }
}


export async function postRentals(req,res){

    const {customerId, gameId, daysRented} = {...req.body}
    const {error} = createRentalSchema.validate(req.body)

   
    const rentDate = new Date();
    try{
        
        if(error){
            res.status(400).send(error);
            return;
        }

        if(daysRented<=0){
            res.sendStatus(400);
        }

        const checkIfExistGame = await db.query(`select * from games where id = $1;`,[gameId]);
        const checkIfExistCustomer = await db.query(`select * from customers where id = $1;`,[customerId]);
       

        if(checkIfExistGame.rows.length===0 || checkIfExistCustomer.rows.length===0){
            res.sendStatus(400)
            return;
        }
        const gameData = await  db.query('select "stockTotal","pricePerDay" from games where id=$1;',[gameId]) //pegando o stockTotal e o pricePerDay do jogo

        const rentalsNumber =  (await db.query('select * from rentals where "gameId"=$1',[gameId])).rows.length //quantos alugueis tem de um determinado jogo

        if(rentalsNumber === gameData.rows[0].stockTotal){ //verificando se o umero de alugueis ja é igual ao numero do jogo em estoque
            res.status(400).send('Estoque esgotado. Não é possivel alugar até a devolução de algum exemplar do jogo')
            return;
        }

        await db.query(`INSERT INTO rentals ("customerId", "gameId", "rentDate", "daysRented", "returnDate", "originalPrice", "delayFee") values ($1, $2, $3, $4, $5, $6, $7)`, [customerId, gameId, rentDate, daysRented, null, daysRented*gameData.rows[0].pricePerDay, null ]);

        res.sendStatus(201);
      
      
    }catch(err){
        res.status(500).send(err.message)
    }
}

export async function finishRentals(req,res){



    const returnDate = new Date();
    const { id } =  req.params

    try{
        const checkIfExist = await db.query('select * from rentals where id=$1',[id])

        if(checkIfExist.rowCount===0){
            res.sendStatus(404);
            return;
        }

        if(checkIfExist.rows[0].delayFee !== null){
            res.sendStatus(400)
            return;
        }

        const pricePerDay = checkIfExist.rows[0].originalPrice/checkIfExist.rows[0].daysRented
       await db.query('update rentals set "returnDate"=$1 where id=$2',[returnDate,id]) // upando a coluna de data de retorno do aluguel quando devolverem
       
       const rentDate = checkIfExist.rows[0].rentDate
       const daysRented = checkIfExist.rows[0].daysRented
       const diffEmMilissegundos = returnDate.getTime() - rentDate.getTime();
       const diffEmDias = Math.floor(diffEmMilissegundos / (1000 * 60 * 60 * 24));
       let delayFee = diffEmDias - daysRented
       delayFee = Math.max(delayFee, 0);
        await db.query('update rentals set "delayFee"=$1 where id=$2',[delayFee*pricePerDay,id])
        res.sendStatus(200);
        
    }catch(err){
       res.send(err.message)
    }
}

export async function deleteRentals(req,res){
    const { id } =  req.params
    
    try{
      
        const checkIfExist = await db.query('select * from rentals where id=$1',[id]);

        if(checkIfExist.rowCount===0){
            res.sendStatus(404);
            return;
        }

        if(checkIfExist.rows[0].returnDate === null){
            res.sendStatus(400)
            return;
        }
        
        await db.query('delete from rentals where id=$1',[id])
        res.sendStatus(200)
    }catch(err){
        res.status(500).send(err.message)
    }
}
