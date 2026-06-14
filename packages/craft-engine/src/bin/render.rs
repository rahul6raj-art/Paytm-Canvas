#[cfg(not(target_arch = "wasm32"))]
fn main() {
    use craft_engine::parse_document;
    use craft_engine::headless::render_document_png_auto_size;
    use std::env;
    use std::fs;
    use std::process;

    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        eprintln!("Usage: craft-render <input.json> <output.png>");
        process::exit(1);
    }
    let input_path = &args[1];
    let output_path = &args[2];
    let json = fs::read_to_string(input_path).unwrap_or_else(|e| {
        eprintln!("read {input_path}: {e}");
        process::exit(1);
    });
    let doc = parse_document(&json).unwrap_or_else(|e| {
        eprintln!("parse document: {e}");
        process::exit(1);
    });
    let (png, w, h) = render_document_png_auto_size(&doc, 32.0).unwrap_or_else(|e| {
        eprintln!("render: {e}");
        process::exit(1);
    });
    fs::write(output_path, png).unwrap_or_else(|e| {
        eprintln!("write {output_path}: {e}");
        process::exit(1);
    });
    println!("Wrote {output_path} ({w}x{h})");
}

#[cfg(target_arch = "wasm32")]
fn main() {}
