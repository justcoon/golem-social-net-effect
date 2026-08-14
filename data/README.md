# Sample Data

This directory contains sample data and import scripts for the Golem Social Net application.

## Data Files

- `fixtures/*.csv`: Sample data
- `import.yaml`: Configuration for importing the sample data using the Drill framework

## Importing Sample Data

### Prerequisites

1. Install [drill](https://github.com/fcsonline/drill):
   ```bash
   cargo install drill
   ```

2. Ensure the Golem Shopping application is running

### Environment Variables

- `HOST`: Worker service API gateway host (e.g., `http://localhost:9006`)
- `API_HOST`: API deployment host/site (e.g., `http://localhost:9006`)

### Running the Import

From the `data` directory, run:

```bash
HOST=http://localhost:9006 API_HOST=localhost:9006 drill --benchmark import.yaml --stats
```

This will import all sample data into your Golem Social Net application.

## Data Structure

### Users (`users.csv`)
- `user-id`: Unique identifier for the user
- `body`: JSON string containing user details (name, description, etc.)

### Friends (`friends.csv`)
- `user-id`: Unique identifier for the user
- `body`: JSON string containing connection details - `connection-type`: Type of connection: Friend

### Followings (`followings.csv`)
- `user-id`: Unique identifier for the user
- `body`: JSON string containing connection details - `connection-type`: Type of connection: Following

### Posts (`posts.csv`)
- `user-id`: Unique identifier for the user
- `body`: JSON string containing post


## Troubleshooting

- Ensure both the API gateway and the application are running before importing data
- Verify that the environment variables are correctly set
- Check the console output for any error messages during import