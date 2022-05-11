use chrono::{DateTime, Utc};
struct Transaction {
    sender: String,   //Public Key of sender
    reciever: String, //Public Key of reciever
    quantity: usize,
}
struct Block {
    index: usize,
    timestamp: DateTime,
    transactions: Vec<Transaction>,
    proof: String,
    previous_hash: String,
}

impl Block {
    fn new() -> Block {
        Block {
            index: 0,
            timestamp: Utc::now(),
            transactions: Vec::new(),
            proof: String::new(),
            previous_hash: String::new(),
        }
    }
}
