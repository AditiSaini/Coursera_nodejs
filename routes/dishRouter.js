const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const authenticate = require("../authenticate");
const cors = require("./cors");

//Aim is to interact dish (with the dish model) router with the server using mongoose
const Dishes = require("../models/dishes");

const dishRouter = express.Router();
dishRouter.use(bodyParser.json());

// mounting of the dish router has to be done in the index.js file
//preflight method, client sends options request and then the actual one
dishRouter
  .route("/")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    //req and res passed on to this function (because of next) with modified res object
    //Aim: return all dishes from the model to the client
    Dishes.find({})
      //populate author field from the user document (user.js)
      .populate("comments.author")
      .then(
        dishes => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          //Takes a string and puts in the body of the response and sends as a json response to the client
          res.json(dishes);
        },
        err => next(err)
      )
      .catch(err => next(err));
  })
  //only allow post request if the user is authenticated
  .post(
    cors.corsWithOptions,
    authenticate.verifyUser,
    authenticate.verifyAdmin,
    (req, res, next) => {
      //req body will contain information
      //req.body is accessible because of body-parser
      //Expectation: name and description property in the post request sent by the client
      Dishes.create(req.body)
        .then(
          dish => {
            console.log("Dish created", dish);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.json(dish);
          },
          err => next(err)
        )
        .catch(err => next(err));
    }
  )
  .put(
    cors.corsWithOptions,
    authenticate.verifyUser,
    authenticate.verifyAdmin,
    (req, res, next) => {
      res.statusCode = 403;
      res.end("PUT operation not supported on /dishes");
    }
  )
  .delete(
    cors.corsWithOptions,
    authenticate.verifyUser,
    authenticate.verifyAdmin,
    (req, res, next) => {
      Dishes.remove({})
        .then(
          resp => {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            //send the response to the client
            res.json(resp);
          },
          err => next(err)
        )
        .catch(err => next(err));
    }
  );

dishRouter
  .route("/:dishId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    Dishes.findById(req.params.dishId)
      .populate("comments.author")
      .then(
        dishes => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          //Takes a string and puts in the body of the response and sends as a json response to the client
          res.json(dishes);
        },
        err => next(err)
      )
      .catch(err => next(err));
  })
  .post(
    cors.corsWithOptions,
    authenticate.verifyUser,
    authenticate.verifyAdmin,
    (req, res, next) => {
      res.statusCode = 403;
      res.end("POST operation not supported on /dishes/" + req.params.dishId);
    }
  )
  .put(
    cors.corsWithOptions,
    authenticate.verifyUser,
    authenticate.verifyAdmin,
    (req, res, next) => {
      Dishes.findByIdAndUpdate(
        req.params.dishId,
        {
          $set: req.body
        },
        //so find by id updates the updated dish as a json reply
        { new: true }
      )
        .then(
          dish => {
            console.log("Dish updated", dish);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.json(dish);
          },
          err => next(err)
        )
        .catch(err => next(err));
    }
  )
  .delete(
    cors.corsWithOptions,
    authenticate.verifyUser,
    authenticate.verifyAdmin,
    (req, res, next) => {
      Dishes.findByIdAndRemove(req.params.dishId)
        .then(
          resp => {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            //send the response to the client
            res.json(resp);
          },
          err => next(err)
        )
        .catch(err => next(err));
    }
  );

dishRouter
  .route("/:dishId/comments")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    Dishes.findById(req.params.dishId)
      .populate("comments.author")
      .then(
        dish => {
          if (dish != null) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.json(dish.comments);
          } else {
            err = new Error("Dish " + req.params.dishId + " not found");
            err.statusCode = 404;
            return next(err);
          }
        },
        err => next(err)
      )
      .catch(err => next(err));
  })
  //verifyUser populates req.user in the body
  .post(cors.corsWithOptions, authenticate.verifyUser, (req, res, next) => {
    //take dish id, return dish and  get the comment from the body to add it to the dish
    Dishes.findById(req.params.dishId)
      .then(
        dish => {
          if (dish != null) {
            //body contains the comment field but author wont be there anymore
            //depending on which user we can populate the id for author field
            req.body.author = req.user._id;
            //body contains only raiting and comment
            //purpose of automatically loading user data is to retrieve the value from the server side
            dish.comments.push(req.body);
            dish.save().then(
              dish => {
                Dishes.findById(dish._id)
                  .populate("comments.author")
                  .then(dish => {
                    //if the dish gets saved
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "application/json");
                    //send the dish with updated comments to teh user with populated author info
                    res.json(dish);
                  });
              },
              err => next(err)
            );
          } else {
            err = new Error("Dish " + req.params.dishId) + " not found";
            err.statusCode = 404;
            return next(err);
          }
        },
        err => next(err)
      )
      .catch(err => next(err));
  })
  .put(cors.corsWithOptions, authenticate.verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end(
      "PUT operation not supported on /dishes/" +
        req.params.dishId +
        "/comments"
    );
  })
  //remove all the comments from the dish
  .delete(
    cors.corsWithOptions,
    authenticate.verifyUser,
    authenticate.verifyAdmin,
    (req, res, next) => {
      Dishes.findById(req.params.dishId)
        .then(
          dish => {
            if (dish != null) {
              for (var i = dish.comments.length - 1; i >= 0; i--) {
                //accesses the subdocument, then id of subdocument is used to remove one element from the subdocuments
                dish.comments.id(dish.comments[i]._id).remove();
              }
              dish.save().then(
                dish => {
                  res.statusCode = 200;
                  res.setHeader("Content-Type", "application/json");
                  res.json(dish);
                },
                err => next(err)
              );
            } else {
              err = new Error("Dish " + req.params.dishId) + " not found";
              err.statusCode = 404;
              return next(err);
            }
          },
          err => next(err)
        )
        .catch(err => next(err));
    }
  );

dishRouter
  .route("/:dishId/comments/:commentId")
  .options(cors.corsWithOptions, (req, res) => {
    res.sendStatus(200);
  })
  .get(cors.cors, (req, res, next) => {
    Dishes.findById(req.params.dishId)
      .populate("comments.author")
      .then(
        dish => {
          //3 conds
          if (dish != null && dish.comments.id(req.params.commentId) != null) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.json(dish.comments.id(req.params.commentId));
          } else if (dish == null) {
            err = new Error("Dish " + req.params.dishId + " not found");
            err.statusCode = 404;
            return next(err);
            //if comment doesnt exist
          } else {
            err = new Error("Comment " + req.params.commentId + " not found");
            err.statusCode = 404;
            return next(err);
          }
        },
        err => next(err)
      )
      .catch(err => next(err));
  })
  .post(cors.corsWithOptions, authenticate.verifyUser, (req, res, next) => {
    res.statusCode = 403;
    res.end(
      "POST operation not supported on /dishes/" +
        req.params.dishId +
        "/comments/" +
        req.params.commentId
    );
  })
  .put(cors.corsWithOptions, authenticate.verifyUser, (req, res, next) => {
    Dishes.findById(req.params.dishId)
      .then(
        dish => {
          if (dish != null && dish.comments.id(req.params.commentId) != null) {
            if (
              req.user._id.equals(
                dish.comments.id(req.params.commentId).author._id
              )
            ) {
              //Comment can be changed but author cant be changed
              if (req.body.rating) {
                dish.comments.id(req.params.commentId).rating = req.body.rating;
              }
              if (req.body.comment) {
                dish.comments.id(req.params.commentId).comment =
                  req.body.comment;
              }
              dish.save().then(
                dish => {
                  Dishes.findById(dish._id)
                    //populate with author info
                    .populate("comments.author")
                    .then(dish => {
                      res.statusCode = 200;
                      res.setHeader("Content-Type", "application/json");
                      res.json(dish);
                    });
                },
                err => next(err)
              );
            } else {
              err = new Error(
                "You are not authorised to modify someone else's comment"
              );
              req.statusCode = 403;
              return next(err);
            }
          } else if (dish == null) {
            err = new Error("Dish " + req.params.dishId) + " not found";
            err.statusCode = 404;
            return next(err);
          } else {
            err = new Error("Comment " + req.params.commentId) + " not found";
            err.statusCode = 404;
            return next(err);
          }
        },
        err => next(err)
      )
      .catch(err => next(err));
  })
  .delete(cors.corsWithOptions, authenticate.verifyUser, (req, res, next) => {
    Dishes.findById(req.params.dishId)
      .then(
        dish => {
          if (dish != null && dish.comments.id(req.params.commentId) != null) {
            if (
              req.user._id.equals(
                dish.comments.id(req.params.commentId).author._id
              )
            ) {
              dish.comments.id(req.params.commentId).remove();
              dish.save().then(
                dish => {
                  Dishes.findById(dish._id)
                    .populate("comments.author")
                    .then(dish => {
                      //if the dish gets saved
                      res.statusCode = 200;
                      res.setHeader("Content-Type", "application/json");
                      //send the dish with updated comments to teh user with populated author info
                      res.json(dish);
                    });
                },
                err => next(err)
              );
            } else {
              err = new Error(
                "You are not authorised to delete someone else's comment"
              );
              req.statusCode = 403;
              return next(err);
            }
          } else if (dish == null) {
            err = new Error("Dish " + req.params.dishId) + " not found";
            err.statusCode = 404;
            return next(err);
          } else {
            err = new Error("Comment " + req.params.commentId) + " not found";
            err.statusCode = 404;
            return next(err);
          }
        },
        err => next(err)
      )
      .catch(err => next(err));
  });

module.exports = dishRouter;
