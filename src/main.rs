use std::env;

mod blocks;

fn main() {
    let args: Vec<String> = env::args().collect();

    if &args[1] == "node" {
        // Run Node Module
    } else if &args[1] == "admin" {
        //run admin api interface
    } else {
        panic!("Please input a valid command!");
    }
}
